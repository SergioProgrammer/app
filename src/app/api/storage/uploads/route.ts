import { NextResponse, type NextRequest } from 'next/server'
import {
  deleteFileFromDrive,
  listFilesFromDrive,
  uploadFileToDrive,
} from '@/server/google-drive'
import { processLabelAutomation } from '@/server/label-automation'

export const runtime = 'nodejs'

function normalizeFolderId(folderId: string | null) {
  if (!folderId) return null
  return folderId.trim().replace(/^\/+/, '').replace(/\/+$/, '')
}

function getFolderId(request: NextRequest, formData?: FormData) {
  const queryFolder = request.nextUrl.searchParams.get('folder')
  const bodyFolder = formData ? String(formData.get('folder') ?? '') : null
  const envFolder = process.env.GOOGLE_DRIVE_FOLDER_ID ?? null

  const candidate = normalizeFolderId(bodyFolder ?? queryFolder ?? envFolder)
  if (!candidate) {
    throw new Error(
      'No se especificó carpeta de almacenamiento. Configura GOOGLE_DRIVE_FOLDER_ID o envía "folder" en la petición.',
    )
  }
  return candidate
}

function getOptionalString(value: FormDataEntryValue | null): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

export async function GET(request: NextRequest) {
  try {
    const folderId = getFolderId(request)
    const files = await listFilesFromDrive(folderId)
    return NextResponse.json({ files })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al consultar archivos.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const folderId = getFolderId(request, formData)
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No se recibió ningún archivo para subir.' },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const manualLote = formData.get('manualLote')
    const manualFechaEnvasado = formData.get('manualFechaEnvasado')
    const manualCodigoCoc = formData.get('manualCodigoCoc')
    const manualCodigoR = formData.get('manualCodigoR')
    const userEmailValue = formData.get('userEmail')
    const manualFields = {
      lote: getOptionalString(manualLote),
      fechaEnvasado: getOptionalString(manualFechaEnvasado),
      codigoCoc: getOptionalString(manualCodigoCoc),
      codigoR: getOptionalString(manualCodigoR),
    }
    const metadata = {
      userEmail: userEmailValue ? String(userEmailValue) : undefined,
      manualFields,
    }
    const description =
      manualFields.lote ||
      manualFields.fechaEnvasado ||
      manualFields.codigoCoc ||
      manualFields.codigoR
        ? JSON.stringify(metadata)
        : undefined

    const uploaded = await uploadFileToDrive({
      folderId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      buffer,
      description,
    })

    let automation: unknown = null
    let automationError: string | null = null

    const driveFileId = typeof uploaded.id === 'string' ? uploaded.id : null
    if (driveFileId) {
      try {
        automation = await processLabelAutomation({
          fileId: driveFileId,
          fileName: uploaded.name ?? file.name,
          existingDescription: description ?? null,
          destination: null,
          notes: null,
          folderId,
          templatePath: process.env.LABEL_TEMPLATE_PATH ?? null,
          manualFields,
        })
      } catch (error) {
        automationError =
          error instanceof Error
            ? error.message
            : 'No se pudo completar la automatización de etiquetas.'
        console.error('[storage/uploads] Error al procesar la automatización de etiquetas:', error)
      }
    } else {
      automationError = 'No se pudo identificar el archivo subido en Google Drive para automatizarlo.'
    }

    return NextResponse.json({ file: uploaded, automation, automationError })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo subir el archivo en este momento.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { fileId } = await request.json()
    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json({ error: 'Falta el identificador del archivo.' }, { status: 400 })
    }

    await deleteFileFromDrive(fileId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo eliminar el archivo en este momento.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
