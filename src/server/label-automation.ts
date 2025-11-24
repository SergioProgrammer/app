import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_LABEL_TYPE,
  normalizeLabelType,
  normalizeProductForLabelType,
  type LabelType,
} from '@/lib/product-selection'
import { renderLabelPdf, renderLidlLabelSet, type LabelRenderFields, type LabelRenderResult } from './label-renderer'

export interface ManualLabelFields {
  labelType?: LabelType | string | null
  productName?: string | null
  variety?: string | null
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
  labelFilePath?: string | null
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
  labels: LabelRenderResult[]
}

const DEFAULT_WEIGHT_TEXT = '40gr'
const LOT_PATTERN = /^[A-Z]{2}\d{5}$/
const LEGACY_LOT_PATTERN = /^[A-Z]{2}\d{4}$/
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LIDL_WEIGHT_BUCKET = process.env.SUPABASE_LIDL_WEIGHT_BUCKET ?? 'grande_final'
const LIDL_DETAIL_BUCKET = process.env.SUPABASE_LIDL_DETAIL_BUCKET ?? 'grande2_final'

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

  const resolvedTemplatePath = templatePath ?? process.env.LABEL_TEMPLATE_PATH ?? undefined
  const lidlTemplatePath =
    preparedFields.labelType === 'lidl'
      ? resolveLidlTemplatePath(preparedFields.productName) ?? resolvedTemplatePath
      : undefined
  let labels: LabelRenderResult[] = []

  try {
    const useLidlExtras = preparedFields.labelType === 'lidl'
    const templateToUse = preparedFields.labelType === 'lidl' ? lidlTemplatePath : resolvedTemplatePath
    const baseSeed = useLidlExtras
      ? resolveLidlBaseSeed(preparedFields.lote, fileName)
      : deriveBaseSeed(fileName)

    if (useLidlExtras) {
      const lidlFileNames = buildLidlFileNames(preparedFields.lote, baseSeed)
      const [baseLabel, summaryLabel, detailLabel] = await renderLidlLabelSet({
        fields: preparedFields,
        fileName: baseSeed,
        templatePath: templateToUse,
      })
      labels = [
        { ...baseLabel, fileName: lidlFileNames.product },
        summaryLabel
          ? {
              ...summaryLabel,
              fileName: lidlFileNames.caja1,
              storageBucket: LIDL_WEIGHT_BUCKET,
            }
          : null,
        detailLabel
          ? {
              ...detailLabel,
              fileName: lidlFileNames.caja2,
              storageBucket: LIDL_DETAIL_BUCKET,
            }
          : null,
      ].filter(Boolean) as LabelRenderResult[]
    } else {
      const label = await renderLabelPdf({
        fields: preparedFields,
        fileName,
        templatePath: templateToUse,
        options: {
          hideCodigoR: preparedFields.labelType === 'lidl',
        },
      })
      labels = [label]
    }

    const automation: LabelAutomationMetadata = {
      status: 'completed',
      processedAt: new Date().toISOString(),
      fields: combinedFields,
      notes:
        labels.length > 1
          ? `Se generaron ${labels.length} etiquetas a partir de valores manuales.`
          : `Etiqueta generada a partir de valores manuales${
              labels[0]?.fileName ? ` (${labels[0].fileName})` : ''
            }.`,
      labelFileName: labels[0]?.fileName ?? null,
      labelFileId: null,
      labelWebContentLink: null,
      labelWebViewLink: null,
    }

    return { automation, labels }
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

    return { automation, labels: [] }
  }
}

function normalizeManualFields(manualFields: ManualLabelFields | undefined): ManualLabelFields {
  const normalizedLabelType = normalizeLabelType(manualFields?.labelType ?? DEFAULT_LABEL_TYPE)
  return {
    labelType: normalizedLabelType,
    productName: normalizeField(manualFields?.productName),
    variety: normalizeField(manualFields?.variety),
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
  const resolvedLabelType = normalizeLabelType(fields.labelType ?? DEFAULT_LABEL_TYPE)
  const resolvedProduct = normalizeProductForLabelType(resolvedLabelType, fields.productName)
  return {
    labelType: resolvedLabelType,
    productName: resolvedProduct,
    variety: normalizeField(fields.variety),
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

function normalizeProductKey(value?: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function resolveLidlBaseSeed(lot: string | null | undefined, fallbackFileName: string): string {
  const normalizedLot = normalizeLotFormat(lot) ?? sanitizeLotText(lot)
  if (normalizedLot) {
    return `pedido-manual-${normalizedLot}`
  }
  return deriveBaseSeed(fallbackFileName)
}

function buildLidlFileNames(lot: string | null | undefined, fallbackSeed: string): {
  product: string
  caja1: string
  caja2: string
} {
  const normalizedLot = normalizeLotFormat(lot) ?? sanitizeLotText(lot)
  const seed = normalizedLot ? `pedido-manual-${normalizedLot}` : fallbackSeed
  return {
    product: `${seed}-etiqueta.pdf`,
    caja1: `${seed}-caja-etiqueta.pdf`,
    caja2: `${seed}-caja2-etiqueta.pdf`,
  }
}

function deriveBaseSeed(fileName: string): string {
  const trimmed = fileName.trim()
  const withoutExtension = trimmed.replace(/\.pdf$/i, '')
  const withoutEtiqueta = withoutExtension.replace(/-etiqueta$/i, '')
  const sanitized = withoutEtiqueta
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[^A-Za-z0-9-_]/g, '')
  return sanitized.length > 0 ? sanitized : 'etiqueta'
}

function sanitizeLotText(value?: string | null): string | null {
  if (!value) return null
  const cleaned = value.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return cleaned.length > 0 ? cleaned : null
}


function resolveLidlTemplatePath(productName?: string | null): string | undefined {
  if (!productName) return undefined
  const normalizedKey = normalizeTemplateKey(productName)
  const baseDir = path.join(process.cwd(), 'public')
  const suffixes = ['-lidl.pdf', '-lidl-template.pdf', 'lidl.pdf', 'lidl-template.pdf', 'lidl_etiqueta.pdf', 'lidlpdf.pdf']
  for (const suffix of suffixes) {
    const candidate = path.join(baseDir, `${normalizedKey}${suffix}`)
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

function normalizeTemplateKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}
