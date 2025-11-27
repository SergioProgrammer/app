import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import type { LabelType } from '@/lib/product-selection'
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PDFDocument,
  StandardFonts,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  scale,
  translate,
  type PDFFont,
} from 'pdf-lib'

export interface LabelRenderFields {
  fechaEnvasado?: string | null
  lote?: string | null
  labelCode?: string | null
  codigoCoc?: string | null
  codigoR?: string | null
  weight?: string | null
  labelType?: LabelType | null
  productName?: string | null
  variety?: string | null
}

export interface LabelRenderResult {
  buffer: Buffer
  fileName: string
  mimeType: string
  storageBucket?: string
}

const DEFAULT_TEMPLATE_CANDIDATES = [
  path.join('public', 'Etiqueta.pdf'),
  path.join('public', 'Etiqueta.png'),
]
const ALDI_TEMPLATE_CANDIDATES = [
  path.join('public', 'Etiqueta-Aldi.pdf'),
  path.join('public', 'etiqueta-aldi.pdf'),
  path.join('public', 'Etiqueta_Aldi.pdf'),
]
const ALDI_TRACE_PREFIX = 'E'
const ALDI_TRACE_LENGTH = 5
const MERCADONA_TRACE_PREFIX = 'E'
const MERCADONA_TRACE_LENGTH = 5
const DEFAULT_FONT_SIZE = 55
const DEFAULT_FONT_COLOR = rgb(0, 0, 0)
const DEFAULT_FONT_NAME = StandardFonts.Helvetica
const LABEL_FONT_ENV_KEY = 'LABEL_FONT_PATH'
const DEFAULT_FONT_CANDIDATES = [
  path.join('public', 'fonts', 'Arial.ttf'),
  path.join('public', 'Arial.ttf'),
  path.join('public', 'fonts', 'arial.ttf'),
  '/Library/Fonts/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
  '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
  '/usr/share/fonts/truetype/msttcorefonts/arial.ttf',
]
let cachedFontBytes: Uint8Array | null = null
let customFontLoadAttempted = false

interface LayoutEntry {
  baseX: number
  baseY: number
  fontSize?: number
  align?: 'left' | 'center' | 'right'
}

const BASE_WIDTH = 1262
const BASE_HEIGHT = 768
const LABEL_WIDTH_MM = 67
const LABEL_HEIGHT_MM = 41
const PX_PER_MM_X = BASE_WIDTH / LABEL_WIDTH_MM
const PX_PER_MM_Y = BASE_HEIGHT / LABEL_HEIGHT_MM

type TemplateLayoutField = 'fechaEnvasado' | 'lote' | 'codigoCoc' | 'codigoR'

const TEXT_OFFSETS: Partial<Record<TemplateLayoutField, { dx?: number; dy?: number }>> = {
  fechaEnvasado: { dx: 18, dy: -8 },
  lote: { dx: 42, dy: -25 },
  codigoR: { dx: -15, dy: -70 },
}

const TEXT_LAYOUT: Record<TemplateLayoutField, LayoutEntry> = {
  fechaEnvasado: { baseX: 325, baseY: 415, align: 'left', fontSize: 34 },
  lote: { baseX: 215, baseY: 490, align: 'left', fontSize: 34 },
  codigoCoc: { baseX: 205, baseY: 630, align: 'left', fontSize: 34 },
  codigoR: { baseX: 1020, baseY: 505, align: 'left', fontSize: 27 },
}

const WEIGHT_LAYOUT: LayoutEntry = {
  baseX: 235,
  baseY: 570,
  align: 'left',
  fontSize: 37,
}
const WEIGHT_OFFSET = { dx: 26, dy: -35 }

type WhiteLabelVariant = Extract<LabelType, 'blanca-grande' | 'blanca-pequena'>

interface WhiteLabelConfig {
  width: number
  height: number
  margin: number
  lineSpacing: number
  titleSize: number
  bodySize: number
  smallSize: number
}

interface WhiteLabelLine {
  text: string
  size?: number
  spacing?: number
  align?: 'left' | 'center' | 'right'
}

const WHITE_LABEL_CONFIGS: Record<WhiteLabelVariant, WhiteLabelConfig> = {
  'blanca-grande': {
    width: 720,
    height: 360,
    margin: 40,
    lineSpacing: 32,
    titleSize: 30,
    bodySize: 20,
    smallSize: 17,
  },
  'blanca-pequena': {
    width: 480,
    height: 260,
    margin: 28,
    lineSpacing: 24,
    titleSize: 22,
    bodySize: 15,
    smallSize: 13,
  },
}

const LIDL_CENTERED_10X5_CONFIG: WhiteLabelConfig = {
  width: 720,
  height: 360,
  margin: 36,
  lineSpacing: 28,
  titleSize: 38,
  bodySize: 26,
  smallSize: 20,
}

const WHITE_LABEL_COMPANY_NAME = 'Montaña Roja Herbs Sat 536/05 OPFH 1168'
const WHITE_LABEL_COMPANY_ADDRESS = 'C/La Constitución 53, Arico Viejo'
const WHITE_LABEL_ORIGIN_LINE = 'Origen: España (Canarias) · CoC: 4063061581198'
const WHITE_LABEL_SMALL_PRODUCER_LINE = 'Producido en España/Islas Canarias por'
const WHITE_LABEL_SMALL_PRODUCER_NAME = 'MONTAÑA ROJA HERBS OPFH 1186'
const WHITE_LABEL_SMALL_ADDRESS = 'C/Castillo 68, piso 6, Santa Cruz de Tenerife'

let cachedTemplateBuffer: Buffer | null = null
let cachedTemplatePath: string | null = null

export async function renderLabelPdf({
  fields,
  fileName,
  templatePath,
  options,
}: {
  fields: LabelRenderFields
  fileName: string
  templatePath?: string
  options?: { hideCodigoR?: boolean; variantSuffix?: string }
}): Promise<LabelRenderResult> {
  if (isAldiLabel(fields.labelType)) {
    try {
      return await renderAldiLabel({ fields, fileName, templatePath })
    } catch (error) {
      console.error('[label-renderer] Aldi render failed, using fallback white label:', error)
      return renderWhiteLabelDocument(fields, fileName, 'blanca-grande', {
        variantSuffix: 'aldi-fallback',
        defaultAlign: 'left',
      })
    }
  }
  if (isWhiteLabelVariant(fields.labelType)) {
    return renderWhiteLabelDocument(fields, fileName, fields.labelType, {
      variantSuffix: options?.variantSuffix,
    })
  }

  const { buffer: templateBuffer, resolvedPath } = await loadTemplate(templatePath)
  const templateExtension = path.extname(resolvedPath).toLowerCase()
  const pdfDoc = await PDFDocument.create()
  const labelFont = await resolveLabelFont(pdfDoc)
  let page: any
  let pageWidth: number
  let pageHeight: number

  if (templateExtension === '.pdf') {
    const templateDoc = await PDFDocument.load(templateBuffer)
    const [templatePage] = await pdfDoc.copyPages(templateDoc, [0])
    page = pdfDoc.addPage(templatePage)
    pageWidth = page.getWidth()
    pageHeight = page.getHeight()
  } else {
    const pngImage = await pdfDoc.embedPng(templateBuffer)
    page = pdfDoc.addPage([pngImage.width, pngImage.height])
    pageWidth = pngImage.width
    pageHeight = pngImage.height

    if (typeof page.drawImage === 'function') {
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height,
      })
    } else {
      const imageName = page.node.newXObject(`Im-${Date.now().toString(36)}`, pngImage.ref)
      page.pushOperators(
        pushGraphicsState(),
        translate(0, 0),
        scale(pngImage.width, pngImage.height),
        drawObject(imageName),
        popGraphicsState(),
      )
    }
  }

  const scaleY = pageHeight / BASE_HEIGHT

  const pageProtoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(page))

  if (process.env.NODE_ENV !== 'production') {
    console.log('[label-renderer] page prototype keys:', pageProtoKeys)
  }

  const hideCodigoR = options?.hideCodigoR ?? false
  const lidlCebollinoOnlyLot = shouldRenderOnlyLot(fields)
  const normalizedProductKey = normalizeSimpleKey(fields.productName)
  const isLidlLabel = (fields.labelType ?? '').toLowerCase() === 'lidl'
  const isMercadona = (fields.labelType ?? '').toLowerCase() === 'mercadona'
  const isLidlAlbahaca = isLidlLabel && normalizedProductKey === 'albahaca'

  ;(Object.keys(TEXT_LAYOUT) as TemplateLayoutField[]).forEach((key: TemplateLayoutField) => {
    if (fields.labelType === 'lidl' && key === 'lote') {
      return
    }
    if (isLidlAlbahaca && key === 'fechaEnvasado') {
      return
    }
    if (key === 'codigoCoc') {
      return
    }
    if (hideCodigoR && key === 'codigoR') {
      return
    }
    if (key === 'codigoR' && !isMercadona) {
      return
    }
    if (lidlCebollinoOnlyLot && key !== 'lote') {
      return
    }
    const isDateField = key === 'fechaEnvasado'
    let value = normalizeFieldValue(fields[key], {
      preserveFormat: isDateField,
      formatAsDate: isDateField,
    })
    if (key === 'codigoR' && !value && isMercadona) {
      value = buildCodigoRFromDate(fields.fechaEnvasado)
    }
    if (key === 'codigoR' && value) {
      value = value.replace(/^[Rr]\s*-?\s*/, '').trim()
    }
    if (!value) return

    const layout = TEXT_LAYOUT[key]
    const fontSize = (layout.fontSize ?? DEFAULT_FONT_SIZE) * scaleY
    const textWidth = measureTextWidth(value, fontSize, labelFont)
    const offset = TEXT_OFFSETS[key] ?? { dx: 0, dy: 0 }
    const baseXmm = pxToMmX(layout.baseX + (offset.dx ?? 0))
    const baseYmm = pxToMmY(layout.baseY + (offset.dy ?? 0))

    const x = resolvePosition(mmToPageX(baseXmm, pageWidth), layout.align, textWidth)
    const y = mmToPageYFromTop(baseYmm, pageHeight)

    if (typeof page.drawText === 'function') {
      page.drawText(value, {
        x,
        y,
        size: fontSize,
        color: DEFAULT_FONT_COLOR,
        font: labelFont,
      })
    }
  })

  if (typeof page.drawText === 'function' && !lidlCebollinoOnlyLot && !isLidlAlbahaca) {
    const layout = WEIGHT_LAYOUT
    const fontSize = (layout.fontSize ?? DEFAULT_FONT_SIZE) * scaleY
    const weightText = normalizeFieldValue(fields.weight, { preserveFormat: true }) ?? '40gr'
    const textWidth = measureTextWidth(weightText, fontSize, labelFont)
    const baseXmm = pxToMmX(layout.baseX + (WEIGHT_OFFSET.dx ?? 0))
    const baseYmm = pxToMmY(layout.baseY + (WEIGHT_OFFSET.dy ?? 0))
    const x = resolvePosition(mmToPageX(baseXmm, pageWidth), layout.align, textWidth)
    const y = mmToPageYFromTop(baseYmm, pageHeight)

    page.drawText(weightText, {
      x,
      y,
      size: fontSize,
      color: DEFAULT_FONT_COLOR,
      font: labelFont,
    })
  }

  if (fields.labelType === 'lidl' && typeof page.drawText === 'function') {
    const lotText = normalizeFieldValue(fields.lote, { preserveFormat: true })
    if (lotText) {
      const normalizedProduct = normalizedProductKey
      const isCilantro = normalizedProduct === 'cilantro'
      const isCebollino = normalizedProduct === 'cebollino'
      const isEneldo = normalizedProduct === 'eneldo'
      const isHierbahuerto = normalizedProduct === 'hierbahuerto'
      const isPerejil = normalizedProduct === 'perejil'
      const isRomero = normalizedProduct === 'romero'
      const desiredCenterX = pageWidth * 0.75

      if (isLidlAlbahaca) {
        const lineY = pageHeight * 0.7 - mmToPageYDelta(pxToMmY(60), pageHeight)
        const spacing = mmToPageXDelta(pxToMmX(80), pageWidth)
        const formattedDate = normalizeFieldValue(fields.fechaEnvasado, {
          formatAsDate: true,
        })
        const dateFontSize = 28 * scaleY
        const lotFontSize = 28 * scaleY
        const dateWidth = formattedDate ? measureTextWidth(formattedDate, dateFontSize, labelFont) : 0
        const lotWidth = measureTextWidth(lotText, lotFontSize, labelFont)
        const totalSpacing = formattedDate ? spacing : 0
        const combinedWidth = dateWidth + lotWidth + totalSpacing
        const startX = Math.max(
          mmToPageX(pxToMmX(60), pageWidth),
          desiredCenterX - combinedWidth / 2 - mmToPageXDelta(pxToMmX(40), pageWidth),
        )
        let cursorX = startX

        const dateOffset = mmToPageXDelta(pxToMmX(30), pageWidth)
        if (formattedDate) {
          page.drawText(formattedDate, {
            x: cursorX - dateOffset,
            y: lineY,
            size: dateFontSize,
            color: DEFAULT_FONT_COLOR,
            font: labelFont,
          })
          cursorX += dateWidth + spacing
        }

        page.drawText(lotText, {
          x: cursorX,
          y: lineY,
          size: lotFontSize,
          color: DEFAULT_FONT_COLOR,
          font: labelFont,
        })

        const weightText = normalizeFieldValue(fields.weight, { preserveFormat: true }) ?? '60gr'
        const weightFontSize = 36 * scaleY
        const weightWidth = measureTextWidth(weightText, weightFontSize, labelFont)
        const weightX = Math.max(
          mmToPageX(pxToMmX(60), pageWidth),
          desiredCenterX - weightWidth / 2 + mmToPageXDelta(pxToMmX(95), pageWidth),
        )
        const weightY = lineY - mmToPageYDelta(pxToMmY(95), pageHeight)
        page.drawText(weightText, {
          x: weightX,
          y: weightY,
          size: weightFontSize,
          color: DEFAULT_FONT_COLOR,
          font: labelFont,
        })
      } else {
        const baseFontSize = 44 * scaleY
        const textWidth = measureTextWidth(lotText, baseFontSize, labelFont)
        const lotOffset = isEneldo ? 30 : isHierbahuerto ? 20 : isPerejil ? 15 : isRomero ? 12 : 10
        const shouldShiftLotLeft =
          isEneldo || isCebollino || isCilantro || isHierbahuerto || isPerejil || isRomero
        const lotShift = isEneldo
          ? 80
          : isHierbahuerto
          ? 70
          : isPerejil
          ? 70
          : shouldShiftLotLeft
          ? 40
          : 0
        const lotOffsetMm = pxToMmX(lotOffset)
        const lotShiftMm = pxToMmX(lotShift)
        const x = Math.max(
          mmToPageX(pxToMmX(60), pageWidth),
          desiredCenterX - textWidth / 2 + mmToPageXDelta(lotOffsetMm, pageWidth) - mmToPageXDelta(lotShiftMm, pageWidth),
        )
        const y = isCilantro
          ? pageHeight / 2 - mmToPageYDelta(pxToMmY(40), pageHeight)
          : isEneldo
          ? pageHeight / 2 - mmToPageYDelta(pxToMmY(25), pageHeight)
          : isHierbahuerto
          ? pageHeight / 2 - mmToPageYDelta(pxToMmY(40), pageHeight)
          : isPerejil
          ? pageHeight / 2 - mmToPageYDelta(pxToMmY(20), pageHeight)
          : isRomero
          ? pageHeight / 2 - mmToPageYDelta(pxToMmY(25), pageHeight)
          : pageHeight / 2 - mmToPageYDelta(pxToMmY(5), pageHeight)
        page.drawText(lotText, {
          x,
          y,
          size: baseFontSize,
          color: DEFAULT_FONT_COLOR,
          font: labelFont,
        })
        if (isEneldo || isHierbahuerto || isPerejil || isRomero) {
          const defaultWeight = isEneldo ? '30g' : '40g'
          const weightText = normalizeFieldValue(fields.weight, { preserveFormat: true }) ?? defaultWeight
          const weightFontSize = (isEneldo ? 110 : 90) * scaleY
          const weightWidth = measureTextWidth(weightText, weightFontSize, labelFont)
          const weightOffset = isEneldo ? 30 : isPerejil ? 15 : isHierbahuerto ? 20 : isRomero ? 12 : 20
          const shouldShiftWeightLeft = isEneldo || isHierbahuerto || isPerejil || isRomero
          const weightShift = isEneldo
            ? 80
            : isHierbahuerto
            ? 50
            : isPerejil
            ? 70
            : shouldShiftWeightLeft
            ? 40
            : 0
          const weightOffsetMm = pxToMmX(weightOffset)
          const weightShiftMm = pxToMmX(weightShift)
          const weightX = Math.max(
            mmToPageX(pxToMmX(60), pageWidth),
            desiredCenterX -
              weightWidth / 2 +
              mmToPageXDelta(weightOffsetMm, pageWidth) -
              mmToPageXDelta(weightShiftMm, pageWidth),
          )
          const weightY = isEneldo
            ? y + mmToPageYDelta(pxToMmY(80), pageHeight)
            : isPerejil
            ? y + mmToPageYDelta(pxToMmY(55), pageHeight)
            : isHierbahuerto
            ? y + mmToPageYDelta(pxToMmY(55), pageHeight)
            : isRomero
            ? y + mmToPageYDelta(pxToMmY(65), pageHeight)
            : y + mmToPageYDelta(pxToMmY(55), pageHeight)
          page.drawText(weightText, {
            x: weightX,
            y: weightY,
            size: weightFontSize,
            color: DEFAULT_FONT_COLOR,
            font: labelFont,
          })
        }
      }
    }
  }

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: buildLabelFileName(fileName, options?.variantSuffix),
    mimeType: 'application/pdf',
  }
}

async function renderWhiteLabelDocument(
  fields: LabelRenderFields,
  fileName: string,
  variant: WhiteLabelVariant,
  options?: {
    lines?: WhiteLabelLine[]
    variantSuffix?: string
    configOverride?: WhiteLabelConfig
    defaultAlign?: 'left' | 'center' | 'right'
  },
): Promise<LabelRenderResult> {
  const config = options?.configOverride ?? WHITE_LABEL_CONFIGS[variant]
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([config.width, config.height])
  const labelFont = await resolveLabelFont(pdfDoc)
  const lines = options?.lines ?? buildWhiteLabelLines(variant, fields)
  let cursorY = config.height - config.margin

  for (const line of lines) {
    const fontSize = line.size ?? config.bodySize
    const align = line.align ?? options?.defaultAlign ?? 'left'
    cursorY -= fontSize
    const y = Math.max(cursorY, config.margin / 2)
    const textWidth = measureTextWidth(line.text, fontSize, labelFont)
    const centeredX = Math.max(config.margin, (config.width - textWidth) / 2)
    const rightAlignedX = Math.max(config.margin, config.width - config.margin - textWidth)
    const x =
      align === 'center'
        ? centeredX
        : align === 'right'
        ? rightAlignedX
        : config.margin
    page.drawText(line.text, {
      x,
      y,
      size: fontSize,
      color: DEFAULT_FONT_COLOR,
      font: labelFont,
    })
    cursorY -= line.spacing ?? config.lineSpacing
  }

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: buildLabelFileName(fileName, options?.variantSuffix),
    mimeType: 'application/pdf',
  }
}

export async function renderLidlLabelSet({
  fields,
  fileName,
  templatePath,
}: {
  fields: LabelRenderFields
  fileName: string
  templatePath?: string
}): Promise<LabelRenderResult[]> {
  const baseLabel = await renderLabelPdf({
    fields,
    fileName,
    templatePath,
    options: { hideCodigoR: true },
  })
  const summaryLines = buildLidl10x5SummaryLines(fields)
  const summaryLabel = await renderWhiteLabelDocument(fields, fileName, 'blanca-grande', {
    lines: summaryLines,
    variantSuffix: 'lidl-10x5-peso',
    configOverride: LIDL_CENTERED_10X5_CONFIG,
    defaultAlign: 'center',
  })
  const detailedLabel = await renderLidlCajaDetailLabel(fields, fileName, {
    variantSuffix: 'lidl-10x5-detalle',
  })
  return [baseLabel, summaryLabel, detailedLabel]
}

function buildWhiteLabelLines(
  variant: WhiteLabelVariant,
  fields: LabelRenderFields,
): WhiteLabelLine[] {
  const product = formatProductText(fields.productName)
  const variety = formatVarietyText(fields.variety)
  const date = formatWhiteLabelDate(fields.fechaEnvasado)
  const lot = formatLotText(fields.lote)
  const config = WHITE_LABEL_CONFIGS[variant]

  if (variant === 'blanca-grande') {
    return [
      { text: product, size: config.titleSize },
      { text: `Categoría 1 · Variedad: ${variety} · Sin/SEM` },
      { text: 'Calibre 3' },
      { text: `Envasado: ${date} · Lote: ${lot}` },
      { text: WHITE_LABEL_COMPANY_NAME },
      { text: WHITE_LABEL_COMPANY_ADDRESS },
      { text: WHITE_LABEL_ORIGIN_LINE },
    ]
  }

  return [
    { text: product, size: config.titleSize },
    { text: `Variedad: ${variety}` },
    { text: `Envasado: ${date}` },
    { text: `Lote: ${lot}` },
    { text: WHITE_LABEL_SMALL_PRODUCER_LINE, size: config.smallSize },
    { text: WHITE_LABEL_SMALL_PRODUCER_NAME },
    { text: WHITE_LABEL_SMALL_ADDRESS, size: config.smallSize },
    { text: 'Origen: España (Canarias)', size: config.smallSize },
  ]
}

function isWhiteLabelVariant(value?: LabelType | null): value is WhiteLabelVariant {
  return value === 'blanca-grande' || value === 'blanca-pequena'
}

function formatProductText(value?: string | null): string {
  const trimmed = value?.trim()
  if (trimmed && trimmed.length > 0) {
    return trimmed.toUpperCase()
  }
  return 'PRODUCTO SIN NOMBRE'
}

function formatVarietyText(value?: string | null): string {
  const trimmed = value?.trim()
  if (trimmed && trimmed.length > 0) {
    return trimmed.toUpperCase()
  }
  return 'SIN VARIEDAD'
}

function formatWhiteLabelDate(value?: string | null): string {
  if (!value) return 'Sin fecha'
  const trimmed = value.trim()
  if (!trimmed) return 'Sin fecha'
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }
  const localeMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (localeMatch) {
    const [, day, month, year] = localeMatch
    const normalizedYear = year.length === 2 ? `20${year}` : year
    const paddedDay = day.padStart(2, '0')
    const paddedMonth = month.padStart(2, '0')
    return `${paddedDay}/${paddedMonth}/${normalizedYear}`
  }
  return trimmed
}

function formatLotText(value?: string | null): string {
  const trimmed = value?.trim()
  if (trimmed && trimmed.length > 0) {
    return trimmed.toUpperCase()
  }
  return 'SIN LOTE'
}

function formatWeightText(value?: string | null): string {
  const trimmed = value?.trim()
  if (trimmed && trimmed.length > 0) {
    return trimmed
  }
  return '40gr'
}

function buildLidlSummaryLines(fields: LabelRenderFields): WhiteLabelLine[] {
  const config = WHITE_LABEL_CONFIGS['blanca-grande']
  const product = formatProductText(fields.productName)
  const weight = formatWeightText(fields.weight)
  return [
    { text: product, size: config.titleSize },
    { text: `Peso unidad: ${weight}` },
  ]
}

function buildLidlDetailLines(fields: LabelRenderFields): WhiteLabelLine[] {
  const product = formatProductText(fields.productName)
  const weight = formatWeightText(fields.weight)
  const variety = formatVarietyText(fields.variety)
  const date = formatWhiteLabelDate(fields.fechaEnvasado)
  const lot = formatLotText(fields.lote)
  const coc = (fields.codigoCoc ?? '').trim()
  const lines: WhiteLabelLine[] = [
    { text: product, size: WHITE_LABEL_CONFIGS['blanca-grande'].titleSize },
    { text: `Variedad: ${variety}` },
    { text: `Peso unidad: ${weight}` },
    { text: `Envasado: ${date}` },
    { text: `Lote: ${lot}` },
  ]
  if (coc.length > 0) {
    lines.push({ text: `CoC: ${coc}` })
  }
  lines.push({ text: WHITE_LABEL_ORIGIN_LINE })
  return lines
}

function buildLidl10x5SummaryLines(fields: LabelRenderFields): WhiteLabelLine[] {
  const product = formatProductText(fields.productName)
  const weight = formatWeightText(fields.weight)
  return [
    { text: `${product} ${weight}`, size: LIDL_CENTERED_10X5_CONFIG.titleSize, align: 'center' },
  ]
}

function buildLidl10x5DetailLines(fields: LabelRenderFields): WhiteLabelLine[] {
  const product = formatProductText(fields.productName)
  const weight = formatWeightText(fields.weight)
  const lot = formatLotText(fields.lote)
  return [
    { text: 'Origen: España', align: 'center', size: LIDL_CENTERED_10X5_CONFIG.bodySize },
    { text: product, align: 'center', size: LIDL_CENTERED_10X5_CONFIG.titleSize },
    { text: `Lote: ${lot}`, align: 'center', size: LIDL_CENTERED_10X5_CONFIG.bodySize },
    { text: `Peso: ${weight}`, align: 'center', size: LIDL_CENTERED_10X5_CONFIG.bodySize },
  ]
}

async function renderLidlCajaDetailLabel(
  fields: LabelRenderFields,
  fileName: string,
  options?: { variantSuffix?: string },
): Promise<LabelRenderResult> {
  const config = LIDL_CENTERED_10X5_CONFIG
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([config.width, config.height])
  const font = await resolveLabelFont(pdfDoc)

  const padding = 20
  const startY = config.height - padding
  const fullWidth = config.width - padding * 2
  const halfWidth = fullWidth / 2
  const topRowHeight = 64
  const rowHeight = 46

  const drawBox = ({
    x,
    y,
    w,
    h,
    label,
    value,
    valueSize,
  }: {
    x: number
    y: number
    w: number
    h: number
    label: string
    value: string
    valueSize?: number
  }) => {
    page.drawRectangle({ x, y: y - h, width: w, height: h, borderWidth: 1, color: undefined, borderColor: DEFAULT_FONT_COLOR })
    const labelSize = 10
    const valSize = valueSize ?? 18
    const labelY = y - 14
    const valY = y - h / 2 - valSize / 2 + 4
    page.drawText(label, { x: x + 6, y: labelY, size: labelSize, font, color: DEFAULT_FONT_COLOR })
    page.drawText(value, {
      x: x + 6,
      y: valY,
      size: valSize,
      font,
      color: DEFAULT_FONT_COLOR,
      maxWidth: w - 12,
    })
  }

  const companyLine = WHITE_LABEL_COMPANY_NAME
  const product = formatProductText(fields.productName)
  const variety = formatVarietyText(fields.variety)
  const lot = formatLotText(fields.lote)
  const date = formatWhiteLabelDate(fields.fechaEnvasado)
  const weight = formatWeightText(fields.weight)
  const ean = normalizeFieldValue(fields.labelCode, { preserveFormat: true }) ?? ''
  const origin = 'ESPAÑA / CANARIAS'
  const units = '12 UNIDADES CAJA'
  const categoria = '-'
  const agenciaCodigo = '34583'

  let cursorY = startY

  // Línea superior: Producto + Lote
  drawBox({
    x: padding,
    y: cursorY,
    w: fullWidth,
    h: topRowHeight,
    label: 'PRODUCTO / LOTE',
    value: `${product} · ${lot}`,
    valueSize: 20,
  })
  cursorY -= topRowHeight

  // Agricultor / Origen
  drawBox({
    x: padding,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'AGRICULTOR',
    value: companyLine,
    valueSize: 12,
  })
  drawBox({
    x: padding + halfWidth,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'ORIGEN',
    value: origin,
    valueSize: 14,
  })
  cursorY -= rowHeight

  // Envasador / Categoría
  drawBox({
    x: padding,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'ENVASADOR',
    value: companyLine,
    valueSize: 12,
  })
  drawBox({
    x: padding + halfWidth,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'CATEGORÍA',
    value: categoria,
    valueSize: 18,
  })
  cursorY -= rowHeight

  // Proveedor / Variedad
  drawBox({
    x: padding,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'PROVEEDOR',
    value: companyLine,
    valueSize: 12,
  })
  drawBox({
    x: padding + halfWidth,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'VARIEDAD',
    value: variety,
    valueSize: 16,
  })
  cursorY -= rowHeight

  // Agencia (código, lote Lidl, unidades)
  drawBox({
    x: padding,
    y: cursorY,
    w: fullWidth,
    h: rowHeight,
    label: 'AGENCIA',
    value: `${agenciaCodigo} · Lote Lidl: ${lot} · ${units}`,
    valueSize: 14,
  })
  cursorY -= rowHeight

  // EAN / Peso / Fecha compactos al final
  const miniRowHeight = rowHeight
  drawBox({
    x: padding,
    y: cursorY,
    w: halfWidth,
    h: miniRowHeight,
    label: 'EAN',
    value: ean,
    valueSize: 16,
  })
  drawBox({
    x: padding + halfWidth,
    y: cursorY,
    w: halfWidth,
    h: miniRowHeight,
    label: 'PESO / FECHA',
    value: `${weight} · ${date}`,
    valueSize: 14,
  })

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: buildLabelFileName(fileName, options?.variantSuffix),
    mimeType: 'application/pdf',
  }
}

function normalizeSimpleKey(value?: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function pxToMmX(px: number): number {
  return px / PX_PER_MM_X
}

function pxToMmY(px: number): number {
  return px / PX_PER_MM_Y
}

function mmToPageX(mm: number, pageWidth: number): number {
  return (mm / LABEL_WIDTH_MM) * pageWidth
}

function mmToPageYFromTop(mm: number, pageHeight: number): number {
  return pageHeight - (mm / LABEL_HEIGHT_MM) * pageHeight
}

function mmToPageXDelta(mm: number, pageWidth: number): number {
  return (mm / LABEL_WIDTH_MM) * pageWidth
}

function mmToPageYDelta(mm: number, pageHeight: number): number {
  return (mm / LABEL_HEIGHT_MM) * pageHeight
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function buildCodigoRFromDate(value?: string | null): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return ''
  const offset = parsed.getUTCDay() === 6 ? 5 : 4
  const deliveryDate = addDaysUtc(parsed, offset)
  const day = deliveryDate.getUTCDate()
  return `R-${day}`
}

function shouldRenderOnlyLot(fields: LabelRenderFields): boolean {
  if ((fields.labelType ?? '').toLowerCase() !== 'lidl') {
    return false
  }
  const normalizedProduct = normalizeSimpleKey(fields.productName)
  return (
    normalizedProduct === 'cebollino' ||
    normalizedProduct === 'cilantro' ||
    normalizedProduct === 'eneldo' ||
    normalizedProduct === 'hierbahuerto' ||
    normalizedProduct === 'perejil' ||
    normalizedProduct === 'romero'
  )
}

async function resolveLabelFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const fontBytes = await loadPreferredFontBytes()
  if (fontBytes) {
    try {
      pdfDoc.registerFontkit(fontkit)
      return await pdfDoc.embedFont(fontBytes, { subset: true })
    } catch (error) {
      console.warn('[label-renderer] No se pudo incrustar Arial Bold, usamos la fuente por defecto.', error)
    }
  }
  return pdfDoc.embedFont(DEFAULT_FONT_NAME)
}

async function loadPreferredFontBytes(): Promise<Uint8Array | null> {
  if (cachedFontBytes) {
    return cachedFontBytes
  }
  if (customFontLoadAttempted) {
    return null
  }
  customFontLoadAttempted = true
  const candidates = getFontSearchPaths()
  for (const candidate of candidates) {
    try {
      const buffer = await readFile(candidate)
      cachedFontBytes = buffer
      return cachedFontBytes
    } catch {
      // continue with next candidate
    }
  }
  return null
}

function getFontSearchPaths(): string[] {
  const explicit = process.env[LABEL_FONT_ENV_KEY]
  const candidates = [
    explicit,
    ...DEFAULT_FONT_CANDIDATES,
  ].filter((candidate): candidate is string => Boolean(candidate))
  return candidates.map((candidate) => {
    if (/^[A-Za-z]:\\/.test(candidate) || candidate.startsWith('\\\\')) {
      return candidate
    }
    return path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate)
  })
}

async function loadTemplate(customPath?: string): Promise<{ buffer: Buffer; resolvedPath: string }> {
  const searchPaths = customPath ? [customPath, ...DEFAULT_TEMPLATE_CANDIDATES] : DEFAULT_TEMPLATE_CANDIDATES
  for (const candidate of searchPaths) {
    const resolvedPath = path.isAbsolute(candidate)
      ? candidate
      : path.join(process.cwd(), candidate)
    if (cachedTemplateBuffer && cachedTemplatePath === resolvedPath) {
      return { buffer: cachedTemplateBuffer, resolvedPath }
    }
    try {
      const buffer = await readFile(resolvedPath)
      cachedTemplateBuffer = buffer
      cachedTemplatePath = resolvedPath
      return { buffer, resolvedPath }
    } catch {
      continue
    }
  }
  throw new Error('No se encontró la plantilla de etiqueta (buscamos Etiqueta.pdf o Etiqueta.png en /public).')
}

function resolvePosition(
  absoluteX: number,
  align: LayoutEntry['align'],
  textWidth: number,
): number {
  if (align === 'center') {
    return absoluteX - textWidth / 2
  }
  if (align === 'right') {
    return absoluteX - textWidth
  }
  return absoluteX
}

function normalizeFieldValue(
  value?: string | null,
  options?: { preserveFormat?: boolean; formatAsDate?: boolean },
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (options?.formatAsDate) {
    if (isoMatch) {
      const [, year, month, day] = isoMatch
      return buildDayMonthYear(day, month, year)
    }
    const localeMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
    if (localeMatch) {
      const [, day, month, year] = localeMatch
      return buildDayMonthYear(day, month, year)
    }
  }
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return options?.preserveFormat ? trimmed : buildDayMonthYear(day, month, year)
  }
  if (options?.preserveFormat) {
    return trimmed
  }
  return trimmed.toUpperCase()
}

function measureTextWidth(text: string, fontSize: number, font: PDFFont): number {
  if (!text) return 0
  try {
    return font.widthOfTextAtSize(text, fontSize)
  } catch {
    const averageCharWidth = fontSize * 0.6
    return text.length * averageCharWidth
  }
}

function buildDayMonthYear(day: string, month: string, year: string): string {
  const normalizedDay = day.padStart(2, '0')
  const normalizedMonth = month.padStart(2, '0')
  const shortYear = year.length === 4 ? year.slice(-2) : year.slice(-2).padStart(2, '0')
  return `${normalizedDay}.${normalizedMonth}.${shortYear}`
}

function buildLabelFileName(originalFileName: string, variantSuffix?: string): string {
  const withoutExtension = originalFileName.replace(/\.[^/.]+$/u, '')
  const sanitized =
    withoutExtension.length > 0 ? withoutExtension : `etiqueta-${Date.now().toString(36)}`
  const suffix = variantSuffix ? `-${variantSuffix}` : ''
  return `${sanitized}${suffix}-etiqueta.pdf`
}

function normalizeTemplateKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeAldiTraceValue(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return null
  const normalizedDigits = digits.slice(-ALDI_TRACE_LENGTH).padStart(ALDI_TRACE_LENGTH, '0')
  return `${ALDI_TRACE_PREFIX}${normalizedDigits}`
}

function normalizeAldiLotValue(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const [, rawWeek, rawDay] = match
  const week = rawWeek.padStart(2, '0')
  const day = rawDay.padStart(2, '0')
  return `${week}/${day}`
}

function normalizeMercadonaTraceValue(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return null
  const normalizedDigits = digits.slice(-MERCADONA_TRACE_LENGTH).padStart(MERCADONA_TRACE_LENGTH, '0')
  return `${MERCADONA_TRACE_PREFIX}${normalizedDigits}`
}

function isAldiLabel(value?: LabelType | null): boolean {
  return (value ?? '').toLowerCase() === 'aldi'
}

const ALDI_SPECIAL_TEMPLATE_MAP: Record<string, string> = {
  hojasfrescasacelga: 'acelgasaldi.pdf',
  albahaca: 'albahacasaldi.pdf',
  cebollino: 'cebollinosaldi.pdf',
  cilantro: 'cilantrosaldi.pdf',
  eneldo: 'eneldosaldi.pdf',
}

function isAldiSpecialKey(normalizedKey: string): boolean {
  return Boolean(ALDI_SPECIAL_TEMPLATE_MAP[normalizedKey])
}

function resolveAldiTemplatePath(
  customPath?: string | null,
  productName?: string | null,
): string | undefined {
  const productCandidates: string[] = []
  if (productName) {
    const key = normalizeTemplateKey(productName)
    if (isAldiSpecialKey(key)) {
      productCandidates.push(path.join(process.cwd(), 'public', ALDI_SPECIAL_TEMPLATE_MAP[key]))
    } else {
      const suffixes = ['-aldi.pdf', '_aldi.pdf', '-aldi-template.pdf', '-aldi_etiqueta.pdf', 'aldi.pdf']
      for (const suffix of suffixes) {
        productCandidates.push(path.join(process.cwd(), 'public', `${key}${suffix}`))
      }
    }
  }
  const candidates = [
    customPath ?? null,
    ...productCandidates,
    ...ALDI_TEMPLATE_CANDIDATES,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)

  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate)
    if (existsSync(resolved)) {
      return resolved
    }
  }

  return undefined
}

async function renderAldiLabel({
  fields,
  fileName,
  templatePath,
}: {
  fields: LabelRenderFields
  fileName: string
  templatePath?: string
}): Promise<LabelRenderResult> {
  const preferredTemplate = resolveAldiTemplatePath(templatePath, fields.productName)
  let templateBuffer: Buffer
  let resolvedPath: string

  try {
    if (!preferredTemplate) {
      throw new Error('No encontramos plantilla específica para Aldi.')
    }
    resolvedPath = path.isAbsolute(preferredTemplate)
      ? preferredTemplate
      : path.join(process.cwd(), preferredTemplate)
    templateBuffer = await readFile(resolvedPath)
  } catch (error) {
    console.error('[label-renderer] Aldi template load failed, using fallback white label:', error)
    const fallbackLines = buildAldiFallbackLines(fields)
    return renderWhiteLabelDocument(fields, fileName, 'blanca-grande', {
      lines: fallbackLines,
      variantSuffix: 'aldi-fallback',
      defaultAlign: 'left',
    })
  }

  const templateExtension = path.extname(resolvedPath).toLowerCase()
  const pdfDoc = await PDFDocument.create()
  const labelFont = await resolveLabelFont(pdfDoc)

  let page: any
  let pageWidth: number
  let pageHeight: number

  if (templateExtension === '.pdf') {
    const templateDoc = await PDFDocument.load(templateBuffer)
    const [templatePage] = await pdfDoc.copyPages(templateDoc, [0])
    page = pdfDoc.addPage(templatePage)
    pageWidth = page.getWidth()
    pageHeight = page.getHeight()
  } else {
    const pngImage = await pdfDoc.embedPng(templateBuffer)
    page = pdfDoc.addPage([pngImage.width, pngImage.height])
    pageWidth = pngImage.width
    pageHeight = pngImage.height

    if (typeof page.drawImage === 'function') {
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height,
      })
    } else {
      const imageName = page.node.newXObject(`Im-${Date.now().toString(36)}`, pngImage.ref)
      page.pushOperators(
        pushGraphicsState(),
        translate(0, 0),
        scale(pngImage.width, pngImage.height),
        drawObject(imageName),
        popGraphicsState(),
      )
    }
  }

  const marginX = pageWidth * 0.08
  const product = formatProductText(fields.productName)
  const weight = formatWeightText(fields.weight)
  const trazabilidad =
    normalizeAldiTraceValue(fields.codigoR) ??
    normalizeAldiTraceValue(fields.lote) ??
    formatLotText(fields.codigoR) ??
    formatLotText(fields.lote)
  const loteAldi = normalizeAldiLotValue(fields.lote) ?? formatLotText(fields.lote)
  const coc =
    normalizeFieldValue(fields.codigoCoc, { preserveFormat: true }) ??
    WHITE_LABEL_ORIGIN_LINE.split('CoC:').pop()?.trim() ??
    ''
  const normalizedProductKey = normalizeTemplateKey(fields.productName ?? '')
  const isAldiSpecial = isAldiSpecialKey(normalizedProductKey)
  const lotSeed = normalizeAldiLotValue(fields.lote)
  const sanitizeBase = (value: string) =>
    value
      .replace(/\.[^/.]+$/u, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  const rawBase = sanitizeBase(fileName)
  const baseWithPrefix = rawBase.startsWith('pedido-manual-') ? rawBase : `pedido-manual-${rawBase}`
  const aldiBaseSeed = lotSeed
    ? `pedido-manual-${lotSeed.replace('/', '-')}`
    : baseWithPrefix
  const orderSuffix = Date.now().toString().slice(-2)
  const outputFileName = `${aldiBaseSeed}-${orderSuffix}-etiqueta.pdf`
  const productFontSize = isAldiSpecial
    ? Math.max(10, Math.min(13, pageWidth * 0.01))
    : Math.max(12, Math.min(16, pageWidth * 0.012))
  const bodySize = isAldiSpecial
    ? Math.max(4.5, Math.min(5.5, pageWidth * 0.0038))
    : Math.max(6, Math.min(8, pageWidth * 0.0055))
  const smallSize = isAldiSpecial
    ? Math.max(3.5, Math.min(4.5, pageWidth * 0.003))
    : Math.max(5, Math.min(7, pageWidth * 0.0045))
  const lineSpacing = bodySize + 1.5
  const baseY = Math.max(pageHeight * 0.8, pageHeight - 120)

  if (!isAldiSpecial) {
    page.drawText(product, {
      x: marginX,
      y: baseY,
      size: productFontSize,
      font: labelFont,
      color: DEFAULT_FONT_COLOR,
    })
  }

  const leftLines = isAldiSpecial
    ? []
    : [
        `CATEGORIA: I    VARIEDAD: ${formatVarietyText(fields.variety)}`,
        'ORIGEN: ESPAÑA/CANARIAS',
        `TRAZABILIDAD: ${trazabilidad}    LOTE ALDI: ${loteAldi}`,
        'ENVASADO POR: MONTAÑA ROJA HERBS SAT536/05',
        'C/CONSTITUCION 53 ARICO',
        'ART: 6007576    OPFH:1168',
        'GGN: 4063061564405',
        `CoC: ${coc}`,
      ]

  leftLines.forEach((text, index) => {
    page.drawText(text, {
      x: marginX,
      y: baseY - lineSpacing * (index + 1),
      size: index >= 6 ? smallSize : bodySize,
      font: labelFont,
      color: DEFAULT_FONT_COLOR,
      maxWidth: pageWidth * 0.7,
    })
  })

  if (isAldiSpecial) {
    const isAlbahaca = normalizedProductKey === 'albahaca' || normalizedProductKey.includes('albahaca')
    const isCilantro = normalizedProductKey === 'cilantro' || normalizedProductKey.includes('cilantro')
    const isCebollino = normalizedProductKey === 'cebollino' || normalizedProductKey.includes('cebollino')
    const isEneldo = normalizedProductKey === 'eneldo' || normalizedProductKey.includes('eneldo')

    const loteY = isAlbahaca
      ? pageHeight * 0.27
      : isCilantro
      ? pageHeight * 0.27
      : isCebollino
      ? pageHeight * 0.27
      : isEneldo
      ? pageHeight * 0.27
      : pageHeight * 0.30
    const pesoY = loteY + bodySize * 0.9
    const leftX = isCilantro
      ? pageWidth * 0.52
      : isCebollino
      ? pageWidth * 0.52
      : isEneldo
      ? pageWidth * 0.54
      : pageWidth * 0.49
    const rightX = isCilantro
      ? pageWidth * 0.66
      : isCebollino
      ? pageWidth * 0.66
      : isEneldo
      ? pageWidth * 0.70
      : pageWidth * 0.66
    const codeX = isAlbahaca
      ? mmToPageX(15, pageWidth)
      : isCilantro
      ? mmToPageX(15, pageWidth)
      : isCebollino
      ? mmToPageX(16, pageWidth)
      : isEneldo
      ? mmToPageX(15, pageWidth)
      : mmToPageX(14, pageWidth)
    const codeY = isAlbahaca
      ? pageHeight * 0.275
      : isCilantro
      ? pageHeight * 0.27
      : isCebollino
      ? pageHeight * 0.27
      : isEneldo
      ? pageHeight * 0.26
      : pageHeight * 0.28

    page.drawText(loteAldi, {
      x: leftX,
      y: loteY,
      size: bodySize + 1,
      font: labelFont,
      color: DEFAULT_FONT_COLOR,
    })
    page.drawText(trazabilidad, {
      x: codeX,
      y: codeY,
      size: bodySize + 1,
      font: labelFont,
      color: DEFAULT_FONT_COLOR,
    })
    page.drawText(weight, {
      x: rightX,
      y: pesoY,
      size: bodySize + 1,
      font: labelFont,
      color: DEFAULT_FONT_COLOR,
    })
  } else {
    const weightY = baseY - lineSpacing * 2 + bodySize / 2
    page.drawText(weight, {
      x: pageWidth * 0.76,
      y: weightY,
      size: bodySize,
      font: labelFont,
      color: DEFAULT_FONT_COLOR,
    })
  }

  if (!isAldiSpecial) {
    const barcodeValue = sanitizeBarcodeValue(fields.labelCode)
    if (barcodeValue) {
      drawEan13Barcode(page, barcodeValue, {
        x: pageWidth * 0.52,
        y: pageHeight * 0.04,
        width: pageWidth * 0.34,
        height: pageHeight * 0.1,
        font: labelFont,
      })
    }
  }

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: outputFileName,
    mimeType: 'application/pdf',
  }
}

function sanitizeBarcodeValue(value?: string | null): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return null
  if (digits.length >= 13) {
    return digits.slice(0, 13)
  }
  if (digits.length === 12) {
    const check = computeEan13CheckDigit(digits)
    return `${digits}${check}`
  }
  return digits.padEnd(13, '0').slice(0, 13)
}

function computeEan13CheckDigit(code12: string): number {
  const digits = code12.split('').map((digit) => Number(digit) || 0)
  const sum = digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const mod = sum % 10
  return mod === 0 ? 0 : 10 - mod
}

function buildEan13Pattern(code: string): string {
  const sanitized = sanitizeBarcodeValue(code)
  if (!sanitized || sanitized.length !== 13) return ''
  const firstDigit = Number(sanitized[0]) || 0
  const parityPattern = [
    'OOOOOO',
    'OOEOEE',
    'OOEEOE',
    'OOEEEO',
    'OEOOEE',
    'OEEOOE',
    'OEEEOO',
    'OEOEOE',
    'OEOEEO',
    'OEEOEO',
  ][firstDigit]
  const leftDigits = sanitized.slice(1, 7)
  const rightDigits = sanitized.slice(7)

  const leftPatterns = leftDigits
    .split('')
    .map((digit, index) =>
      encodeEanLeftDigit(Number(digit) || 0, parityPattern[index] === 'E' ? 'even' : 'odd'),
    )
  const rightPatterns = rightDigits.split('').map((digit) => encodeEanRightDigit(Number(digit) || 0))

  return ['101', ...leftPatterns, '01010', ...rightPatterns, '101'].join('')
}

function encodeEanLeftDigit(digit: number, parity: 'odd' | 'even'): string {
  const oddPatterns = [
    '0001101',
    '0011001',
    '0010011',
    '0111101',
    '0100011',
    '0110001',
    '0101111',
    '0111011',
    '0110111',
    '0001011',
  ]
  const evenPatterns = [
    '0100111',
    '0110011',
    '0011011',
    '0100001',
    '0011101',
    '0111001',
    '0000101',
    '0010001',
    '0001001',
    '0010111',
  ]
  return parity === 'even' ? evenPatterns[digit] : oddPatterns[digit]
}

function encodeEanRightDigit(digit: number): string {
  const patterns = [
    '1110010',
    '1100110',
    '1101100',
    '1000010',
    '1011100',
    '1001110',
    '1010000',
    '1000100',
    '1001000',
    '1110100',
  ]
  return patterns[digit]
}

function drawEan13Barcode(
  page: any,
  code: string,
  options: { x: number; y: number; width: number; height: number; font: PDFFont },
) {
  const pattern = buildEan13Pattern(code)
  if (!pattern) return
  const barWidth = options.width / pattern.length
  const barHeight = options.height

  Array.from(pattern).forEach((bit, index) => {
    if (bit !== '1') return
    page.drawRectangle({
      x: options.x + index * barWidth,
      y: options.y,
      width: barWidth,
      height: barHeight,
      color: DEFAULT_FONT_COLOR,
      borderColor: DEFAULT_FONT_COLOR,
    })
  })

  const textSize = Math.max(10, options.width * 0.025)
  const textWidth = options.font.widthOfTextAtSize(code, textSize)
  const textX = options.x + (options.width - textWidth) / 2
  page.drawText(code, {
    x: textX,
    y: options.y - textSize - 4,
    size: textSize,
    font: options.font,
    color: DEFAULT_FONT_COLOR,
  })
}

function buildAldiFallbackLines(fields: LabelRenderFields): WhiteLabelLine[] {
  const lote = normalizeAldiLotValue(fields.lote) ?? formatLotText(fields.lote)
  const codigoE =
    normalizeAldiTraceValue(fields.codigoR) ??
    normalizeAldiTraceValue(fields.lote) ??
    formatLotText(fields.codigoR) ??
    'SIN CODIGO'
  const peso = formatWeightText(fields.weight)
  return [
    { text: `LOTE ALDI: ${lote}` },
    { text: `CÓDIGO E: ${codigoE}` },
    { text: `PESO: ${peso}` },
  ]
}
