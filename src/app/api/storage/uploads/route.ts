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
const MANUAL_ORDER_FILE_PREFIX = 'pedido-manual-'

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
    const [baseFiles, labelFiles] = await Promise.all([
      listFilesFromBucket(ALBARANES_BUCKET, folderPath),
      listFilesFromBucket(ETIQUETAS_BUCKET, folderPath).catch((error) => {
        console.error('[storage/uploads] Error listing etiquetas bucket:', error)
        return []
      }),
    ])
    const combined = [...baseFiles, ...labelFiles]
    return NextResponse.json({ files: combined })
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
    const manualLabelType = formData.get('labelType')
    const manualProductName = formData.get('productName')
    const manualVariety = formData.get('variety')
    const manualCategory = formData.get('category')
    const userEmailValue = formData.get('userEmail')
    const fechaEnvasadoValue = getOptionalString(manualFechaEnvasado)
    const fechaCargaValue = getOptionalString(manualFechaCarga)
    const manualLabelTypeValue = getOptionalString(manualLabelType)
    const isManualPlaceholder =
      typeof file.name === 'string' &&
      file.name.startsWith(MANUAL_ORDER_FILE_PREFIX) &&
      file.type === 'text/plain'
    const skipSourceUpload = isManualPlaceholder

    let detectedFechaCarga: string | null = null
    try {
      detectedFechaCarga = await extractFechaCargaFromImage(buffer)
    } catch (error) {
      console.error('[storage/uploads] OCR failed:', error)
    }

    const manualFields: ManualLabelFields = {
      labelType: manualLabelTypeValue,
      productName: getOptionalString(manualProductName),
      variety: getOptionalString(manualVariety),
      lote: getOptionalString(manualLote),
      fechaCarga: fechaCargaValue ?? fechaEnvasadoValue ?? detectedFechaCarga,
      fechaEnvasado: fechaEnvasadoValue,
      labelCode: getOptionalString(manualLabelCode),
      codigoCoc: getOptionalString(manualCodigoCoc),
      codigoR: getOptionalString(manualCodigoR),
      weight: getOptionalString(manualWeight),
      category: getOptionalString(manualCategory),
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

      const generatedLabels = automationResult.labels ?? []
      if (generatedLabels.length > 0 && automationResult.automation.status === 'completed') {
        try {
          const uploadedDescriptors: Array<Awaited<ReturnType<typeof uploadFileToBucket>>> = []
          const baseFileName = sanitizedFileName.replace(/\.[^/.]+$/u, '')
          for (const labelResult of generatedLabels) {
            if (!labelResult?.fileName) continue
            const effectiveFileName =
              labelResult.fileName && labelResult.fileName.trim().length > 0
                ? labelResult.fileName
                : `${baseFileName}-etiqueta.pdf`
            const targetBucket = labelResult.storageBucket ?? ETIQUETAS_BUCKET
            const labelPath = buildStoragePath(folderPath, effectiveFileName)
            const labelMetadata = {
              generatedFromFileId: targetPath,
              generatedAt: new Date().toISOString(),
              sourceFile: sanitizedFileName,
              variant: effectiveFileName,
            }
            const descriptor = await uploadFileToBucket({
              bucket: targetBucket,
              path: labelPath,
              buffer: labelResult.buffer,
              contentType: labelResult.mimeType,
              metadata: { description: JSON.stringify(labelMetadata) },
            })
            uploadedDescriptors.push(descriptor)
          }

          const [primaryDescriptor] = uploadedDescriptors
          if (primaryDescriptor) {
            automationResult.automation.labelFileId = primaryDescriptor.id
            automationResult.automation.labelFileName = primaryDescriptor.name
            automationResult.automation.labelFilePath = primaryDescriptor.path
            automationResult.automation.labelWebViewLink =
              primaryDescriptor.webViewLink ?? null
            automationResult.automation.labelWebContentLink =
              primaryDescriptor.webContentLink ?? null
          }
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

      if (!skipSourceUpload) {
        await uploadFileToBucket({
          bucket: ALBARANES_BUCKET,
          path: targetPath,
          buffer,
          contentType: file.type || 'application/octet-stream',
          metadata: descriptionPayload ? { description: descriptionPayload } : undefined,
        })
      }

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

      if (!skipSourceUpload) {
        await uploadFileToBucket({
          bucket: ALBARANES_BUCKET,
          path: targetPath,
          buffer,
          contentType: file.type || 'application/octet-stream',
          metadata: descriptionPayload ? { description: descriptionPayload } : undefined,
        })
      }
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
    const { fileId, bucket } = await request.json()
    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json({ error: 'Falta el identificador del archivo.' }, { status: 400 })
    }

    const targetBucket =
      typeof bucket === 'string' && bucket.trim().length > 0 ? bucket.trim() : ALBARANES_BUCKET

    await deleteFileFromBucket(targetBucket, fileId)
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
