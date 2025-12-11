import { NextResponse, type NextRequest } from 'next/server'
import {
  uploadFileToBucket,
  listFilesFromBucket,
  deleteFileFromBucket,
  getSupabaseServiceClient,
  type StorageFileDescriptor,
} from '@/server/supabase-storage'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PEDIDOS_BUCKET = process.env.SUPABASE_PEDIDOS_BUCKET ?? 'pedidos_subidos'
const PEDIDOS_TABLE = process.env.SUPABASE_PEDIDOS_TABLE ?? 'pedidos_subidos'

interface PedidoMetadata {
  estado: string
  status?: string
  client?: string | null
  uploadedAt?: string
  originalName?: string
}

interface PedidoSubidoRow {
  id?: string | null
  created_at?: string | null
  createdAt?: string | null
  uploaded_at?: string | null
  uploadedAt?: string | null
  cliente?: string | null
  client?: string | null
  destino?: string | null
  original_name?: string | null
  originalName?: string | null
  name?: string | null
  file_name?: string | null
  path?: string | null
  storage_path?: string | null
  bucket?: string | null
  estado?: string | null
  status?: string | null
  web_view_link?: string | null
  webViewLink?: string | null
  web_content_link?: string | null
  webContentLink?: string | null
  // Legacy/optional fields that may or may not exist in the schema
  archivo?: string | null
  nombre_archivo?: string | null
}

interface PedidoSubidoPayload {
  id: string
  name: string
  path: string
  bucket?: string | null
  status: string
  estado: string
  client: string
  uploadedAt: string | null
  originalName: string
  webViewLink?: string | null
  webContentLink?: string | null
}

function sanitizeFileName(name: string): string {
  const trimmed = name?.trim() ?? ''
  const safe = trimmed.replace(/[\\/]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-/, '')
  if (safe.length === 0) {
    return `pedido-${Date.now().toString(36)}.pdf`
  }
  return safe
}

function normalizeEstado(value?: string | null): string {
  if (!value) return 'Pendiente'
  const normalized = value.trim()
  if (!normalized) return 'Pendiente'
  const lower = normalized.toLowerCase()
  if (lower === 'pendiente') return 'Pendiente'
  if (lower === 'procesado' || lower === 'procesada') return 'Procesado'
  return normalized
}

function parseMetadata(description?: string | null): PedidoMetadata {
  if (!description) return { estado: 'Pendiente' }
  try {
    const parsed = JSON.parse(description) as Partial<PedidoMetadata>
    return {
      estado: parsed.estado ? normalizeEstado(parsed.estado) : parsed.status ? normalizeEstado(parsed.status) : 'Pendiente',
      client: parsed.client ?? null,
      uploadedAt: parsed.uploadedAt,
      originalName: parsed.originalName,
    }
  } catch {
    return { estado: 'Pendiente' }
  }
}

function mapTableRow(row: PedidoSubidoRow): PedidoSubidoPayload {
  const estado = normalizeEstado(row.estado ?? row.status)
  const fileName =
    row.original_name ??
    row.originalName ??
    row.nombre_archivo ??
    row.archivo ??
    row.file_name ??
    row.name ??
    row.path ??
    ''
  const path = row.path ?? row.storage_path ?? row.name ?? fileName
  const fallbackName = fileName || (path ? path.split('/').pop() ?? path : 'pedido')
  const uploadedAt = row.uploaded_at ?? row.uploadedAt ?? row.created_at ?? row.createdAt ?? null
  return {
    id: (row.id ?? path ?? '').toString(),
    name: (row.name ?? fallbackName ?? 'pedido').toString(),
    path: (path ?? '').toString(),
    bucket: row.bucket ?? PEDIDOS_BUCKET,
    status: estado,
    estado,
    client: (row.client ?? row.cliente ?? row.destino ?? '').toString(),
    uploadedAt,
    originalName: (fallbackName || 'pedido').toString(),
    webViewLink: row.web_view_link ?? row.webViewLink ?? null,
    webContentLink: row.web_content_link ?? row.webContentLink ?? null,
  }
}

async function insertPedidoIntoTable({
  descriptor,
  metadata,
}: {
  descriptor: StorageFileDescriptor
  metadata: PedidoMetadata
}): Promise<PedidoSubidoPayload | null> {
  const supabase = getSupabaseServiceClient()
  const row = {
    id: descriptor.id ?? descriptor.path ?? randomUUID(),
    path: descriptor.path,
    cliente: metadata.client ?? null,
    estado: normalizeEstado(metadata.estado),
  }
  console.log('[pedidos-subidos] insert row', row)
  const { data, error } = await supabase.from(PEDIDOS_TABLE).insert(row).select('*').maybeSingle()

  if (error) {
    console.log('[pedidos-subidos] insert error', error)
    return null
  }

  return mapTableRow((data ?? {}) as PedidoSubidoRow)
}

async function fetchPedidosFromTable(): Promise<PedidoSubidoPayload[]> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.from(PEDIDOS_TABLE).select('*').order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  const rows = Array.isArray(data) ? data : []
  return rows.map((row) => mapTableRow((row ?? {}) as PedidoSubidoRow))
}

async function deleteFromPedidosTable(paths: string[]) {
  if (paths.length === 0) return
  try {
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase.from(PEDIDOS_TABLE).delete().in('path', paths)
    if (error) {
      console.error('[pedidos-subidos] DELETE table error', error)
    }
  } catch (error) {
    console.error('[pedidos-subidos] DELETE table failure', error)
  }
}

function buildFallbackDescriptor({
  descriptor,
  metadata,
}: {
  descriptor: StorageFileDescriptor
  metadata: PedidoMetadata
}): PedidoSubidoPayload {
  const estado = normalizeEstado(metadata.estado)
  return {
    id: descriptor.id,
    name: descriptor.name,
    path: descriptor.path,
    bucket: descriptor.bucket ?? PEDIDOS_BUCKET,
    status: estado,
    estado,
    client: metadata.client ?? '',
    uploadedAt: metadata.uploadedAt ?? descriptor.createdAt ?? null,
    originalName: metadata.originalName ?? descriptor.name,
    webViewLink: descriptor.webViewLink ?? null,
    webContentLink: descriptor.webContentLink ?? null,
  }
}

export async function GET() {
  try {
    const files = await fetchPedidosFromTable()
    return NextResponse.json({ files })
  } catch (tableError) {
    console.error('[pedidos-subidos] GET table error, falling back to storage', tableError)
  }
  try {
    const files = await listFilesFromBucket(PEDIDOS_BUCKET, null)
    const mapped = files.map((file) => {
      const meta = parseMetadata(file.description)
      const estado = normalizeEstado(meta.estado ?? meta.status)
      return {
        id: file.id,
        name: file.name,
        path: file.path,
        bucket: file.bucket ?? PEDIDOS_BUCKET,
        createdAt: file.createdAt,
        status: estado,
        estado,
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
    const uploadPath = fileName
    const contentType = file.type || 'application/octet-stream'

    const metadata: PedidoMetadata = {
      estado: typeof status === 'string' && status.trim().length > 0 ? normalizeEstado(status) : 'Pendiente',
      status: typeof status === 'string' && status.trim().length > 0 ? status : 'Pendiente',
      client: typeof client === 'string' && client.trim().length > 0 ? client.trim() : null,
      uploadedAt: new Date().toISOString(),
      originalName: file.name,
    }

    console.log('[pedidos-subidos] upload path', uploadPath, 'bucket', PEDIDOS_BUCKET)
    const descriptor = await uploadFileToBucket({
      bucket: PEDIDOS_BUCKET,
      path: uploadPath,
      buffer,
      contentType,
      metadata: { description: JSON.stringify({ ...metadata, status: metadata.estado }) },
    })

    let inserted: PedidoSubidoPayload | null = null
    try {
      inserted = await insertPedidoIntoTable({ descriptor, metadata })
    } catch (error) {
      console.error('[pedidos-subidos] POST table error', error)
    }

    const fallback = buildFallbackDescriptor({ descriptor, metadata })
    const filePayload = inserted ?? fallback

    return NextResponse.json({
      file: filePayload,
    })
  } catch (error) {
    console.error('[pedidos-subidos] POST error', error)
    return NextResponse.json({ error: 'No se pudo subir el pedido.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const paths = Array.isArray(body?.paths) ? body.paths : []
    if (paths.length === 0) {
      return NextResponse.json({ error: 'No se recibieron rutas para eliminar.' }, { status: 400 })
    }

    const normalizedPaths = paths
      .map((rawPath: unknown) => (typeof rawPath === 'string' ? rawPath : ''))
      .filter(Boolean)

    await deleteFromPedidosTable(normalizedPaths)

    await Promise.all(
      normalizedPaths.map(async (filePath: string) => {
        try {
          await deleteFileFromBucket(PEDIDOS_BUCKET, filePath)
        } catch (error) {
          console.error('[pedidos-subidos] DELETE error removing file', { path: filePath, error })
        }
      }),
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[pedidos-subidos] DELETE error', error)
    return NextResponse.json({ error: 'No se pudieron eliminar los pedidos.' }, { status: 500 })
  }
}
