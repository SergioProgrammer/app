import {
  updateDriveFileMetadata,
  uploadFileToDrive,
} from './google-drive'
import { renderLabelPdf, type LabelRenderFields } from './label-renderer'

export interface ManualLabelFields {
  lote?: string | null
  fechaEnvasado?: string | null
  fechaCarga?: string | null
  labelCode?: string | null
  codigoCoc?: string | null
  codigoR?: string | null
  weight?: string | null
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

const DEFAULT_WEIGHT_TEXT = '40gr'
const LOT_PATTERN = /^[A-Z]{2}\d{5}$/
const LEGACY_LOT_PATTERN = /^[A-Z]{2}\d{4}$/
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

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
  const normalizedManualFields = descriptionPayload.manualFields ?? {}

  const preparedFields = prepareLabelFields(normalizedManualFields, fileName)
  const combinedFields: ManualLabelFields = {
    ...normalizedManualFields,
    ...preparedFields,
  }

  descriptionPayload.manualFields = combinedFields

  if (!folderId) {
    const automation: LabelAutomationMetadata = {
      status: 'error',
      processedAt: new Date().toISOString(),
      fields: combinedFields,
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
        fields: preparedFields,
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
      fields: combinedFields,
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
      fields: combinedFields,
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
    fechaCarga: normalizeField(manualFields?.fechaCarga ?? payload.manualFields?.fechaCarga),
    fechaEnvasado: normalizeField(manualFields?.fechaEnvasado ?? payload.manualFields?.fechaEnvasado),
    labelCode: normalizeField(manualFields?.labelCode ?? payload.manualFields?.labelCode),
    codigoCoc: normalizeField(manualFields?.codigoCoc ?? payload.manualFields?.codigoCoc),
    codigoR: normalizeField(manualFields?.codigoR ?? payload.manualFields?.codigoR),
    weight: normalizeField(manualFields?.weight ?? payload.manualFields?.weight),
  }

  return payload
}

function normalizeField(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function prepareLabelFields(fields: ManualLabelFields, fileName: string): LabelRenderFields {
  return {
    fechaEnvasado: normalizeField(fields.fechaCarga ?? fields.fechaEnvasado),
    lote: resolveLot(fields.lote, fileName),
    labelCode: normalizeField(fields.labelCode),
    codigoCoc: normalizeField(fields.codigoCoc),
    codigoR: normalizeField(fields.codigoR),
    weight: resolveWeight(fields.weight),
  }
}

function resolveLot(value: string | null | undefined, seed: string): string {
  const normalized = normalizeLotFormat(value)
  if (normalized) return normalized
  return generateLot(seed)
}

function normalizeLotFormat(value: string | null | undefined): string | null {
  if (!value) return null
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (LOT_PATTERN.test(compact)) {
    return compact
  }
  if (LEGACY_LOT_PATTERN.test(compact)) {
    const prefix = compact.slice(0, 2)
    const digits = compact.slice(-4)
    return `${prefix}${digits.padStart(5, '0')}`
  }
  return null
}

function generateLot(seed: string): string {
  const lettersFromSeed = seed
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 2)
  const prefix =
    lettersFromSeed.length === 2
      ? lettersFromSeed
      : `${pickRandomLetter()}${pickRandomLetter()}`
  const digits = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0')
  return `${prefix}${digits}`
}

function pickRandomLetter(): string {
  const index = Math.floor(Math.random() * LETTERS.length)
  return LETTERS[index]
}

function resolveWeight(value: string | null | undefined): string {
  const normalized = normalizeField(value)
  return normalized ?? DEFAULT_WEIGHT_TEXT
}
