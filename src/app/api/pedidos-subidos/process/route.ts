import { NextResponse, type NextRequest } from 'next/server'
import { downloadFileFromBucket, uploadFileToBucket } from '@/server/supabase-storage'
import { parseVisionOrderFromFile } from '@/server/vision-order-parser'
import path from 'node:path'

export const runtime = 'nodejs'

const PEDIDOS_BUCKET = process.env.SUPABASE_PEDIDOS_BUCKET ?? 'pedidos_subidos'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const filePath = searchParams.get('path')
    if (!filePath) {
      return NextResponse.json({ error: 'Falta el path del pedido.' }, { status: 400 })
    }
    const bucket = PEDIDOS_BUCKET
    const { buffer: downloadedBuffer, contentType } = await downloadFileFromBucket(bucket, filePath)
    const mimeType = contentType || inferMime(filePath)
    const nodeBuffer = Buffer.from(downloadedBuffer)

    const parseResult = await parseVisionOrderFromFile(nodeBuffer, mimeType, filePath)

    // Marcamos el pedido como procesado actualizando metadata
    const metadata = {
      description: JSON.stringify({
        status: 'procesado',
        uploadedAt: new Date().toISOString(),
        originalName: path.basename(filePath),
      }),
    }
    await uploadFileToBucket({
      bucket,
      path: filePath,
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
  return 'application/octet-stream'
}
