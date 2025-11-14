import { renderLabelPdf, type LabelRenderFields, type LabelRenderResult } from './label-renderer'

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
  fileName: string
  templatePath?: string | null
  manualFields?: ManualLabelFields
}

export interface ProcessLabelAutomationResult {
  automation: LabelAutomationMetadata
  label: LabelRenderResult | null
}

const DEFAULT_WEIGHT_TEXT = '40gr'
const LOT_PATTERN = /^[A-Z]{2}\d{5}$/
const LEGACY_LOT_PATTERN = /^[A-Z]{2}\d{4}$/
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export async function processLabelAutomation({
  fileName,
  templatePath,
  manualFields,
}: ProcessLabelAutomationParams): Promise<ProcessLabelAutomationResult> {
  const normalizedManualFields = normalizeManualFields(manualFields)

  const preparedFields = prepareLabelFields(normalizedManualFields, fileName)
  const combinedFields: ManualLabelFields = {
    ...normalizedManualFields,
    ...preparedFields,
  }

  try {
    const label = await renderLabelPdf({
      fields: preparedFields,
      fileName,
      templatePath: templatePath ?? process.env.LABEL_TEMPLATE_PATH ?? undefined,
    })

    const automation: LabelAutomationMetadata = {
      status: 'completed',
      processedAt: new Date().toISOString(),
      fields: combinedFields,
      notes: `Etiqueta generada a partir de valores manuales${label.fileName ? ` (${label.fileName})` : ''}.`,
      labelFileName: label.fileName,
      labelFileId: null,
      labelWebContentLink: null,
      labelWebViewLink: null,
    }

    return { automation, label }
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

    return { automation, label: null }
  }
}

function normalizeManualFields(manualFields: ManualLabelFields | undefined): ManualLabelFields {
  return {
    lote: normalizeField(manualFields?.lote),
    fechaCarga: normalizeField(manualFields?.fechaCarga),
    fechaEnvasado: normalizeField(manualFields?.fechaEnvasado),
    labelCode: normalizeField(manualFields?.labelCode),
    codigoCoc: normalizeField(manualFields?.codigoCoc),
    codigoR: normalizeField(manualFields?.codigoR),
    weight: normalizeField(manualFields?.weight),
  }
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
