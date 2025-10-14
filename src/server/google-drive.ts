import { google, type drive_v3 } from 'googleapis'
import { Readable } from 'node:stream'
import type { Readable as NodeReadable } from 'node:stream'

let cachedDrive: drive_v3.Drive | null = null

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    throw new Error(
      'Faltan las variables GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI o GOOGLE_DRIVE_REFRESH_TOKEN. Configúralas en .env.local.',
    )
  }

  return { clientId, clientSecret, redirectUri, refreshToken }
}

function createDrive(): drive_v3.Drive {
  const { clientId, clientSecret, redirectUri, refreshToken } = getOAuthConfig()
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  return google.drive({ version: 'v3', auth: oauth2Client })
}

export function getDrive(): drive_v3.Drive {
  if (!cachedDrive) {
    cachedDrive = createDrive()
  }
  return cachedDrive
}

export interface DriveFileDescriptor {
  id: string
  name: string
  size?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  webViewLink?: string | null
  webContentLink?: string | null
  description?: string | null
  mimeType?: string | null
}

export async function listFilesFromDrive(folderId: string) {
  const drive = getDrive()
  const response = await drive.files.list({
    corpora: 'user',
    includeItemsFromAllDrives: false,
    supportsAllDrives: true,
    q: `'${folderId}' in parents and trashed = false`,
    orderBy: 'createdTime desc',
    fields:
      'files(id, name, size, createdTime, modifiedTime, webViewLink, webContentLink, description, mimeType)',
    pageSize: 100,
  })

  return (response.data.files ?? []).map<DriveFileDescriptor>((file) => ({
    id: file.id ?? '',
    name: file.name ?? 'Archivo sin nombre',
    size: file.size ? Number(file.size) : null,
    createdAt: file.createdTime ?? null,
    updatedAt: file.modifiedTime ?? null,
    webViewLink: file.webViewLink ?? null,
    webContentLink: file.webContentLink ?? null,
    description: file.description ?? null,
    mimeType: file.mimeType ?? null,
  }))
}

interface UploadFileOptions {
  folderId: string
  fileName: string
  mimeType: string
  buffer: Buffer
  description?: string
}

export async function uploadFileToDrive({
  folderId,
  fileName,
  mimeType,
  buffer,
  description,
}: UploadFileOptions) {
  const drive = getDrive()

  const media = {
    mimeType,
    body: Readable.from(buffer),
  }

  const requestBody = {
    name: fileName,
    parents: [folderId],
    description,
  }

  const response = await drive.files.create({
    media,
    requestBody,
    fields: 'id, name, size, createdTime, modifiedTime, webViewLink, webContentLink',
    supportsAllDrives: true,
  })

  const fileId = response.data.id
  if (!fileId) {
    throw new Error('No se obtuvo el ID del archivo subido en Drive.')
  }

  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: false,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })
  } catch (error) {
    console.error('No se pudo aplicar permiso público al archivo.', error)
  }

  return response.data
}

export async function deleteFileFromDrive(fileId: string) {
  const drive = getDrive()
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  })
}

export async function downloadDriveFile(fileId: string) {
  const drive = getDrive()

  const [metaResponse, fileResponse] = await Promise.all([
    drive.files.get({
      fileId,
      fields: 'mimeType',
      supportsAllDrives: true,
    }),
    drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'stream' },
    ),
  ])

  const stream = fileResponse.data as NodeReadable
  const buffer = await streamToBuffer(stream)

  return {
    buffer,
    detectedMimeType:
      typeof metaResponse.data.mimeType === 'string' ? metaResponse.data.mimeType : null,
  }
}

export async function updateDriveFileMetadata(
  fileId: string,
  requestBody: drive_v3.Schema$File,
): Promise<void> {
  const drive = getDrive()
  await drive.files.update({
    fileId,
    supportsAllDrives: true,
    requestBody,
  })
}

async function streamToBuffer(stream: NodeReadable): Promise<Buffer> {
  const chunks: Buffer[] = []
  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', (error) => reject(error))
  })
}
