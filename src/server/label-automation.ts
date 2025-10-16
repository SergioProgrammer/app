import {
  updateDriveFileMetadata,
  uploadFileToDrive,
} from './google-drive'
import { renderLabelPdf } from './label-renderer'

export interface ManualLabelFields {
  lote?: string | null
  fechaEnvasado?: string | null
  labelCode?: string | null
  codigoCoc?: string | null
  codigoR?: string | null
}

export type LabelAutomationStatus = 'completed' | 'error'

export interface LabelAutomationMetadata {
  status: LabelAutomationStatus
  processedAt: string
  fields: ManualLabelFields
  notes?: string | null
  error?: string | null
  labelFileId?: string | null
  labelFileName?: string | null
  labelWebViewLink?: string | null
  labelWebContentLink?: string | null
}

export interface ProcessLabelAutomationParams {
  fileId: string
  fileName: string
  existingDescription?: string | null
  destination?: string | null
  notes?: string | null
  folderId?: string | null
  templatePath?: string | null
  manualFields?: ManualLabelFields
}

interface DescriptionPayload {
  destination?: string | null
  notes?: string | null
  manualFields?: ManualLabelFields
  automation?: LabelAutomationMetadata
  [key: string]: unknown
}

export async function processLabelAutomation({
  fileId,
  fileName,
  existingDescription,
  destination,
  notes,
  folderId,
  templatePath,
  manualFields,
}: ProcessLabelAutomationParams): Promise<LabelAutomationMetadata> {
  const descriptionPayload = mergeDescriptionPayload(existingDescription, destination, notes, manualFields)
  const fields = descriptionPayload.manualFields ?? {}

  if (!folderId) {
    const automation: LabelAutomationMetadata = {
      status: 'error',
      processedAt: new Date().toISOString(),
      fields,
      error: 'No se generó la etiqueta porque falta la carpeta de destino en Google Drive.',
    }

    await updateDriveFileMetadata(fileId, {
      description: JSON.stringify({
        ...descriptionPayload,
        automation,
      }),
    })

    return automation
  }

  try {
    const { buffer: labelBuffer, fileName: labelFileName, mimeType: labelMimeType } =
      await renderLabelPdf({
        fields,
        fileName,
        templatePath: templatePath ?? process.env.LABEL_TEMPLATE_PATH ?? undefined,
      })

    const generated = await uploadFileToDrive({
      folderId,
      fileName: labelFileName,
      mimeType: labelMimeType,
      buffer: labelBuffer,
      description: JSON.stringify({
        generatedFromFileId: fileId,
        generatedAt: new Date().toISOString(),
      }),
    })

    const automation: LabelAutomationMetadata = {
      status: 'completed',
      processedAt: new Date().toISOString(),
      fields,
      notes: `Etiqueta generada a partir de valores manuales${labelFileName ? ` (${labelFileName})` : ''}.`,
      labelFileId: generated.id ?? null,
      labelFileName: generated.name ?? null,
      labelWebViewLink: generated.webViewLink ?? null,
      labelWebContentLink: generated.webContentLink ?? null,
    }

    await updateDriveFileMetadata(fileId, {
      description: JSON.stringify({
        ...descriptionPayload,
        automation,
      }),
    })

    return automation
  } catch (error) {
    const automation: LabelAutomationMetadata = {
      status: 'error',
      processedAt: new Date().toISOString(),
      fields,
      error:
        error instanceof Error
          ? error.message
          : 'Ocurrió un error desconocido generando la etiqueta.',
    }

    await updateDriveFileMetadata(fileId, {
      description: JSON.stringify({
        ...descriptionPayload,
        automation,
      }),
    })

    return automation
  }
}

function mergeDescriptionPayload(
  existingDescription: string | null | undefined,
  destination: string | null | undefined,
  notes: string | null | undefined,
  manualFields: ManualLabelFields | undefined,
): DescriptionPayload {
  let payload: DescriptionPayload = {}

  if (existingDescription && existingDescription.trim().length > 0) {
    try {
      const parsed = JSON.parse(existingDescription)
      if (parsed && typeof parsed === 'object') {
        payload = parsed as DescriptionPayload
      }
    } catch {
      payload = {}
    }
  }

  if (destination) {
    payload.destination = destination
  }

  if (notes) {
    payload.notes = notes
  }

  payload.manualFields = {
    lote: normalizeField(manualFields?.lote ?? payload.manualFields?.lote),
    fechaEnvasado: normalizeField(manualFields?.fechaEnvasado ?? payload.manualFields?.fechaEnvasado),
    labelCode: normalizeField(manualFields?.labelCode ?? payload.manualFields?.labelCode),
    codigoCoc: normalizeField(manualFields?.codigoCoc ?? payload.manualFields?.codigoCoc),
    codigoR: normalizeField(manualFields?.codigoR ?? payload.manualFields?.codigoR),
  }

  return payload
}

function normalizeField(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
