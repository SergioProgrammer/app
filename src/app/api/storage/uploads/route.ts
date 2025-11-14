import { NextResponse, type NextRequest } from 'next/server'
import {
  deleteFileFromBucket,
  listFilesFromBucket,
  uploadFileToBucket,
} from '@/server/supabase-storage'
import {
  processLabelAutomation,
  type LabelAutomationMetadata,
  type ManualLabelFields,
} from '@/server/label-automation'
import { extractFechaCargaFromImage } from '@/server/label-ocr'

export const runtime = 'nodejs'

const ALBARANES_BUCKET = process.env.SUPABASE_ALBARANES_BUCKET ?? 'albaranes_finales'
const ETIQUETAS_BUCKET = process.env.SUPABASE_ETIQUETAS_BUCKET ?? 'etiquetas_final'

function normalizeFolderPath(folderId: string | null) {
  if (!folderId) return null
  return folderId.trim().replace(/^\/+/, '').replace(/\/+$/, '')
}

function getFolderPath(request: NextRequest, formData?: FormData) {
  const queryFolder = request.nextUrl.searchParams.get('folder')
  const bodyFolder = formData ? String(formData.get('folder') ?? '') : null
  const envFolder = process.env.SUPABASE_ALBARANES_FOLDER ?? process.env.GOOGLE_DRIVE_FOLDER_ID ?? null

  const candidate = normalizeFolderPath(bodyFolder ?? queryFolder ?? envFolder)
  if (!candidate) {
    throw new Error(
      'No se especificó carpeta de almacenamiento. Configura SUPABASE_ALBARANES_FOLDER o envía "folder" en la petición.',
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
    const folderPath = getFolderPath(request)
    const files = await listFilesFromBucket(ALBARANES_BUCKET, folderPath)
    return NextResponse.json({ files })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al consultar archivos.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const folderPath = getFolderPath(request, formData)
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
    const manualFechaCarga = formData.get('manualFechaCarga')
    const manualLabelCode = formData.get('manualLabelCode')
    const manualCodigoCoc = formData.get('manualCodigoCoc')
    const manualCodigoR = formData.get('manualCodigoR')
    const manualWeight = formData.get('manualWeight')
    const userEmailValue = formData.get('userEmail')
    const fechaEnvasadoValue = getOptionalString(manualFechaEnvasado)
    const fechaCargaValue = getOptionalString(manualFechaCarga)

    let detectedFechaCarga: string | null = null
    try {
      detectedFechaCarga = await extractFechaCargaFromImage(buffer)
    } catch (error) {
      console.error('[storage/uploads] OCR failed:', error)
    }

    const manualFields: ManualLabelFields = {
      lote: getOptionalString(manualLote),
      fechaCarga: fechaCargaValue ?? fechaEnvasadoValue ?? detectedFechaCarga,
      fechaEnvasado: fechaEnvasadoValue,
      labelCode: getOptionalString(manualLabelCode),
      codigoCoc: getOptionalString(manualCodigoCoc),
      codigoR: getOptionalString(manualCodigoR),
      weight: getOptionalString(manualWeight),
    }

    if (!manualFields.fechaEnvasado && manualFields.fechaCarga) {
      manualFields.fechaEnvasado = manualFields.fechaCarga
    }
    const userEmail = userEmailValue ? String(userEmailValue) : null

    const sanitizedFileName = sanitizeFileName(file.name)
    const targetPath = buildStoragePath(folderPath, sanitizedFileName)

    let automation: LabelAutomationMetadata | null = null
    let automationError: string | null = null

    try {
      const automationResult = await processLabelAutomation({
        fileName: sanitizedFileName,
        manualFields,
        templatePath: process.env.LABEL_TEMPLATE_PATH ?? null,
      })
      automation = automationResult.automation

      if (automationResult.label && automationResult.automation.status === 'completed') {
        try {
          const labelPath = buildStoragePath(folderPath, automationResult.label.fileName)
          const labelMetadata = {
            generatedFromFileId: targetPath,
            generatedAt: new Date().toISOString(),
          }
          const labelDescriptor = await uploadFileToBucket({
            bucket: ETIQUETAS_BUCKET,
            path: labelPath,
            buffer: automationResult.label.buffer,
            contentType: automationResult.label.mimeType,
            metadata: { description: JSON.stringify(labelMetadata) },
          })

          automationResult.automation.labelFileId = labelDescriptor.id
          automationResult.automation.labelFileName = labelDescriptor.name
          automationResult.automation.labelWebViewLink = labelDescriptor.webViewLink ?? null
          automationResult.automation.labelWebContentLink = labelDescriptor.webContentLink ?? null
        } catch (error) {
          automationResult.automation.status = 'error'
          automationResult.automation.error =
            error instanceof Error
              ? error.message
              : 'No se pudo guardar la etiqueta generada en Supabase Storage.'
          automation = automationResult.automation
        }
      }

      const descriptionPayload = buildDescriptionPayload({
        userEmail,
        manualFields,
        automation: automationResult.automation,
      })

      await uploadFileToBucket({
        bucket: ALBARANES_BUCKET,
        path: targetPath,
        buffer,
        contentType: file.type || 'application/octet-stream',
        metadata: descriptionPayload ? { description: descriptionPayload } : undefined,
      })

      automationError =
        automationResult.automation.status === 'error'
          ? automationResult.automation.error ?? 'No se pudo completar la automatización de etiquetas.'
          : null
      automation = automationResult.automation
    } catch (error) {
      automationError =
        error instanceof Error
          ? error.message
          : 'No se pudo completar la automatización de etiquetas.'
      automation = {
        status: 'error',
        processedAt: new Date().toISOString(),
        fields: manualFields,
        error: automationError,
      }
      console.error('[storage/uploads] Error al procesar la automatización de etiquetas:', error)

      const descriptionPayload = buildDescriptionPayload({
        userEmail,
        manualFields,
        automation,
      })

      await uploadFileToBucket({
        bucket: ALBARANES_BUCKET,
        path: targetPath,
        buffer,
        contentType: file.type || 'application/octet-stream',
        metadata: descriptionPayload ? { description: descriptionPayload } : undefined,
      })
    }

    return NextResponse.json({ automation, automationError })
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

    await deleteFileFromBucket(ALBARANES_BUCKET, fileId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo eliminar el archivo en este momento.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function sanitizeFileName(name: string): string {
  const trimmed = name?.trim() ?? ''
  const safe = trimmed.replace(/[\\/]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-/, '')
  if (safe.length === 0) {
    return `archivo-${Date.now().toString(36)}`
  }
  return safe
}

function buildStoragePath(folder: string | null, fileName: string): string {
  const normalizedFolder = normalizeFolderPath(folder)
  const normalizedFileName = fileName.replace(/^\/+/, '')
  return normalizedFolder ? `${normalizedFolder}/${normalizedFileName}` : normalizedFileName
}

function buildDescriptionPayload({
  userEmail,
  manualFields,
  automation,
}: {
  userEmail: string | null
  manualFields: ManualLabelFields
  automation: LabelAutomationMetadata | null
}): string | undefined {
  const payload: Record<string, unknown> = {}

  if (userEmail) {
    payload.userEmail = userEmail
  }

  if (hasManualFieldValues(manualFields)) {
    payload.manualFields = manualFields
  }

  if (automation) {
    payload.automation = automation
  }

  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined
}

function hasManualFieldValues(fields: ManualLabelFields): boolean {
  return Object.values(fields).some((value) => typeof value === 'string' && value.length > 0)
}
