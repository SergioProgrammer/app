import { NextResponse, type NextRequest } from 'next/server'
import { downloadFileFromBucket, uploadFileToBucket, getSupabaseServiceClient } from '@/server/supabase-storage'
import { parseVisionOrderFromFile } from '@/server/vision-order-parser'
import path from 'node:path'

export const runtime = 'nodejs'

const PEDIDOS_BUCKET = process.env.SUPABASE_PEDIDOS_BUCKET ?? 'pedidos_subidos'
const PEDIDOS_TABLE = process.env.SUPABASE_PEDIDOS_TABLE ?? 'pedidos_subidos'

async function markPedidoProcesado({ id, filePath }: { id?: string | null; filePath?: string | null }) {
  if (!id && !filePath) return
  try {
    const supabase = getSupabaseServiceClient()
    const update = supabase.from(PEDIDOS_TABLE).update({ estado: 'Procesado' })
    if (id) {
      await update.eq('id', id)
    } else if (filePath) {
      await update.eq('path', filePath)
    }
  } catch (error) {
    console.error('[pedidos-subidos/process] error marking as Procesado in table', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const filePath = searchParams.get('path')
    const pedidoId = searchParams.get('id')
    if (!filePath) {
      return NextResponse.json({ error: 'Falta el path del pedido.' }, { status: 400 })
    }

    const bucket = PEDIDOS_BUCKET
    const resolvedPath = filePath
    const { buffer: downloadedBuffer, contentType } = await downloadFileFromBucket(bucket, resolvedPath)
    const mimeType = contentType || inferMime(resolvedPath)
    const nodeBuffer = Buffer.from(downloadedBuffer)

    let parseResult
    try {
      parseResult = await parseVisionOrderFromFile(nodeBuffer, mimeType, resolvedPath)
    } catch (error) {
      console.error('[pedidos-subidos/process] parseVisionOrderFromFile error', error)
      parseResult = {
        client: '',
        items: [],
        rawText: 'No se pudo procesar el pedido con visión.',
        notes: `Error de lectura automática. Revisa manualmente. ${(error as Error)?.message ?? ''}`,
      }
    }

    await markPedidoProcesado({ id: pedidoId, filePath: resolvedPath })

    // Marcamos el pedido como procesado actualizando metadata
    const metadata = {
      description: JSON.stringify({
        status: 'Procesado',
        estado: 'Procesado',
        uploadedAt: new Date().toISOString(),
        originalName: path.basename(resolvedPath),
      }),
    }
    await uploadFileToBucket({
      bucket,
      path: resolvedPath,
      buffer: nodeBuffer,
      contentType: mimeType,
      metadata,
    })

    return NextResponse.json({ data: parseResult })
  } catch (error) {
    console.error('[pedidos-subidos/process] error', error)
    return NextResponse.json({ error: 'No se pudo procesar el pedido.' }, { status: 500 })
  }
}

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.xlsx' || ext === '.xlsm' || ext === '.xls' || ext === '.ods')
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === '.csv') return 'text/csv'
  if (ext === '.tsv') return 'text/tab-separated-values'
  return 'application/octet-stream'
}
