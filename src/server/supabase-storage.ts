import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface StorageFileDescriptor {
  id: string
  name: string
  path: string
  bucket?: string | null
  size?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  webViewLink?: string | null
  webContentLink?: string | null
  description?: string | null
  mimeType?: string | null
}

interface SupabaseStorageObject {
  id: string | null
  name: string
  created_at?: string | null
  updated_at?: string | null
  metadata?: Record<string, unknown> | null
}

let cachedClient: SupabaseClient | null = null

export function getSupabaseServiceClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Faltan las variables SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Configúralas en .env.local.',
    )
  }

  cachedClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedClient
}

interface UploadFileOptions {
  bucket: string
  path: string
  buffer: Buffer
  contentType: string
  metadata?: Record<string, unknown>
}

export async function uploadFileToBucket({
  bucket,
  path,
  buffer,
  contentType,
  metadata,
}: UploadFileOptions): Promise<StorageFileDescriptor> {
  const client = getSupabaseServiceClient()
  const { error } = await client.storage.from(bucket).upload(path, buffer, {
    cacheControl: '0',
    contentType,
    upsert: true,
    metadata,
  })

  if (error) {
    console.error('[supabase-storage] Error subiendo archivo', { bucket, path, error })
    throw new Error(error.message || 'No se pudo subir el archivo a Supabase Storage.')
  }

  const descriptor = await getFileDescriptor(bucket, path)
  if (descriptor) {
    return descriptor
  }

  return buildFallbackDescriptor(bucket, path, buffer.length, contentType, metadata)
}

export type DownloadedFile = { buffer: Uint8Array; contentType: string | null }

export async function downloadFileFromBucket(
  bucket: string,
  path: string,
): Promise<DownloadedFile> {
  const client = getSupabaseServiceClient()
  const normalizedPath = path.replace(/^\/+/, '')
  const { data, error } = await client.storage.from(bucket).download(normalizedPath)

  if (error || !data) {
    console.error('[supabase-storage] Error descargando archivo', { bucket, path, error })
    throw new Error(error?.message || 'No se pudo descargar el archivo.')
  }

  const arrayBuffer = await data.arrayBuffer()
  const contentType: string | null = data.type || null
  return { buffer: new Uint8Array(arrayBuffer), contentType }
}

export async function listFilesFromBucket(bucket: string, folder?: string | null) {
  const client = getSupabaseServiceClient()
  const folderPrefix = normalizeFolderPath(folder)
  const limit = 200
  const maxIterations = 15
  const collected: SupabaseStorageObject[] = []
  let offset = 0

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const { data, error } = await client.storage.from(bucket).list(folderPrefix, {
      limit,
      offset,
    })

    if (error) {
      throw new Error('No se pudieron obtener los archivos almacenados.')
    }

    const batch = Array.isArray(data) ? data : []
    if (batch.length === 0) {
      break
    }
    collected.push(...batch)
    if (batch.length < limit) {
      break
    }
    offset += batch.length
  }

  const sortableEntries = collected.filter((entry): entry is SupabaseStorageObject => Boolean(entry?.name))
  sortableEntries.sort((a, b) => {
    const left = new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    const right = new Date(b.updated_at ?? b.created_at ?? 0).getTime()
    return right - left
  })

  const descriptors = await Promise.all(
    sortableEntries.map(async (entry) => {
      const relativePath = folderPrefix ? `${folderPrefix}/${entry.name}` : entry.name
      try {
        const descriptor = await getFileDescriptor(bucket, relativePath)
        if (descriptor) {
          return descriptor
        }
      } catch {
        // ignore and fallback
      }
      return mapStorageObject(bucket, folderPrefix ?? '', entry)
    }),
  )

  return descriptors
}

export async function deleteFileFromBucket(bucket: string, path: string) {
  const client = getSupabaseServiceClient()
  const normalizedPath = path.replace(/^\/+/, '')
  const { error } = await client.storage.from(bucket).remove([normalizedPath])
  if (error) {
    throw new Error('No se pudo eliminar el archivo en Supabase Storage.')
  }
}

export async function getFileDescriptor(bucket: string, path: string): Promise<StorageFileDescriptor | null> {
  const client = getSupabaseServiceClient()
  const normalizedPath = path.replace(/^\/+/, '')
  const { folder, fileName } = splitPath(normalizedPath)

  const { data, error } = await client.storage.from(bucket).list(folder, {
    limit: 200,
    offset: 0,
    search: fileName,
  })

  if (error) {
    throw new Error('No se pudieron leer los metadatos del archivo en Supabase Storage.')
  }

  const entries = Array.isArray(data) ? data : []
  const match = entries.find((entry) => entry.id && entry.name === fileName)
  if (!match) {
    return null
  }

  return mapStorageObject(bucket, folder, match)
}

function buildFallbackDescriptor(
  bucket: string,
  path: string,
  size: number,
  contentType: string,
  metadata?: Record<string, unknown>,
): StorageFileDescriptor {
  const client = getSupabaseServiceClient()
  const normalizedPath = path.replace(/^\/+/, '')
  const { fileName } = splitPath(normalizedPath)
  const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(normalizedPath)
  const publicUrl = publicUrlData?.publicUrl ?? null
  const description = typeof metadata?.description === 'string' ? metadata.description : null

  return {
    id: normalizedPath,
    bucket,
    name: fileName,
    path: normalizedPath,
    size,
    createdAt: null,
    updatedAt: null,
    webViewLink: publicUrl,
    webContentLink: publicUrl,
    description,
    mimeType: contentType,
  }
}

function mapStorageObject(bucket: string, folder: string, entry: SupabaseStorageObject): StorageFileDescriptor {
  const filePath = folder ? `${folder}/${entry.name}` : entry.name
  const metadata = entry.metadata ?? {}
  const size = typeof metadata.size === 'number'
    ? metadata.size
    : typeof metadata.contentLength === 'number'
    ? metadata.contentLength
    : null
  const mimeType = typeof metadata.mimetype === 'string' ? metadata.mimetype : null
  const description = typeof metadata.description === 'string' ? metadata.description : null
  const client = getSupabaseServiceClient()
  const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(filePath)
  const publicUrl = publicUrlData?.publicUrl ?? null

  return {
    id: filePath,
    bucket,
    name: entry.name,
    path: filePath,
    size,
    createdAt: entry.created_at ?? null,
    updatedAt: entry.updated_at ?? null,
    webViewLink: publicUrl,
    webContentLink: publicUrl,
    description,
    mimeType,
  }
}

function splitPath(path: string): { folder: string; fileName: string } {
  const sanitized = path.replace(/^\/+/, '').replace(/\\/g, '/')
  const lastSlash = sanitized.lastIndexOf('/')
  if (lastSlash === -1) {
    return { folder: '', fileName: sanitized }
  }
  return {
    folder: sanitized.slice(0, lastSlash),
    fileName: sanitized.slice(lastSlash + 1),
  }
}

function normalizeFolderPath(folder?: string | null): string {
  if (!folder) return ''
  const trimmed = folder.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed
}
