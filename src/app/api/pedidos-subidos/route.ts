import { NextResponse, type NextRequest } from 'next/server'
import { uploadFileToBucket, listFilesFromBucket } from '@/server/supabase-storage'

export const runtime = 'nodejs'

const PEDIDOS_BUCKET = process.env.SUPABASE_PEDIDOS_BUCKET ?? 'pedidos_subidos'

interface PedidoMetadata {
  status: string
  client?: string | null
  uploadedAt?: string
  originalName?: string
}

function sanitizeFileName(name: string): string {
  const trimmed = name?.trim() ?? ''
  const safe = trimmed.replace(/[\\/]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-/, '')
  if (safe.length === 0) {
    return `pedido-${Date.now().toString(36)}.pdf`
  }
  return safe
}

function parseMetadata(description?: string | null): PedidoMetadata {
  if (!description) return { status: 'pendiente' }
  try {
    const parsed = JSON.parse(description) as Partial<PedidoMetadata>
    return {
      status: parsed.status ?? 'pendiente',
      client: parsed.client ?? null,
      uploadedAt: parsed.uploadedAt,
      originalName: parsed.originalName,
    }
  } catch {
    return { status: 'pendiente' }
  }
}

export async function GET() {
  try {
    const files = await listFilesFromBucket(PEDIDOS_BUCKET, null)
    const mapped = files.map((file) => {
      const meta = parseMetadata(file.description)
      return {
        id: file.id,
        name: file.name,
        path: file.path,
        bucket: file.bucket ?? PEDIDOS_BUCKET,
        createdAt: file.createdAt,
        status: meta.status ?? 'pendiente',
        client: meta.client ?? '',
        uploadedAt: meta.uploadedAt ?? file.createdAt ?? null,
        originalName: meta.originalName ?? file.name,
        webViewLink: file.webViewLink ?? null,
        webContentLink: file.webContentLink ?? null,
      }
    })
    return NextResponse.json({ files: mapped })
  } catch (error) {
    console.error('[pedidos-subidos] GET error', error)
    return NextResponse.json({ error: 'No se pudieron cargar los pedidos subidos.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const client = formData.get('client')
    const status = formData.get('status')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo del pedido.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = sanitizeFileName(file.name || 'pedido.pdf')
    const contentType = file.type || 'application/octet-stream'

    const metadata: PedidoMetadata = {
      status: typeof status === 'string' && status.trim().length > 0 ? status : 'pendiente',
      client: typeof client === 'string' && client.trim().length > 0 ? client.trim() : null,
      uploadedAt: new Date().toISOString(),
      originalName: file.name,
    }

    const descriptor = await uploadFileToBucket({
      bucket: PEDIDOS_BUCKET,
      path: fileName,
      buffer,
      contentType,
      metadata: { description: JSON.stringify(metadata) },
    })

    return NextResponse.json({
      file: {
        id: descriptor.id,
        name: descriptor.name,
        path: descriptor.path,
        bucket: descriptor.bucket ?? PEDIDOS_BUCKET,
        status: metadata.status,
        client: metadata.client ?? '',
        uploadedAt: metadata.uploadedAt,
        originalName: metadata.originalName ?? descriptor.name,
        webViewLink: descriptor.webViewLink ?? null,
        webContentLink: descriptor.webContentLink ?? null,
      },
    })
  } catch (error) {
    console.error('[pedidos-subidos] POST error', error)
    return NextResponse.json({ error: 'No se pudo subir el pedido.' }, { status: 500 })
  }
}
