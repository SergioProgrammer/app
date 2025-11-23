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
}

const DEFAULT_TEMPLATE_CANDIDATES = [
  path.join('public', 'Etiqueta.pdf'),
  path.join('public', 'Etiqueta.png'),
]
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

  const scaleX = pageWidth / BASE_WIDTH
  const scaleY = pageHeight / BASE_HEIGHT

  const pageProtoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(page))

  if (process.env.NODE_ENV !== 'production') {
    console.log('[label-renderer] page prototype keys:', pageProtoKeys)
  }

  const hideCodigoR = options?.hideCodigoR ?? false
  const lidlCebollinoOnlyLot = shouldRenderOnlyLot(fields)
  const normalizedProductKey = normalizeSimpleKey(fields.productName)
  const isLidlLabel = (fields.labelType ?? '').toLowerCase() === 'lidl'
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
    if (lidlCebollinoOnlyLot && key !== 'lote') {
      return
    }
    const isDateField = key === 'fechaEnvasado'
    let value = normalizeFieldValue(fields[key], {
      preserveFormat: isDateField,
      formatAsDate: isDateField,
    })
    if (key === 'codigoR' && value) {
      value = value.replace(/^[Rr]\s*-?\s*/, '').trim()
    }
    if (!value) return

    const layout = TEXT_LAYOUT[key]
    const fontSize = (layout.fontSize ?? DEFAULT_FONT_SIZE) * scaleY
    const textWidth = measureTextWidth(value, fontSize, labelFont)
    const offset = TEXT_OFFSETS[key] ?? { dx: 0, dy: 0 }
    const baseX = layout.baseX + (offset.dx ?? 0)
    const baseY = layout.baseY + (offset.dy ?? 0)

    const x = resolvePosition(baseX * scaleX, layout.align, textWidth)
    const y = pageHeight - baseY * scaleY

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
    const baseX = layout.baseX + (WEIGHT_OFFSET.dx ?? 0)
    const baseY = layout.baseY + (WEIGHT_OFFSET.dy ?? 0)
    const x = resolvePosition(baseX * scaleX, layout.align, textWidth)
    const y = pageHeight - baseY * scaleY

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
      const isEneldo = normalizedProduct === 'eneldo'
      const isHierbahuerto = normalizedProduct === 'hierbahuerto'
      const isPerejil = normalizedProduct === 'perejil'
      const isRomero = normalizedProduct === 'romero'
      const desiredCenterX = pageWidth * 0.75

      if (isLidlAlbahaca) {
        const lineY = pageHeight * 0.7 - 70 * scaleY
        const spacing = 90 * scaleX
        const formattedDate = normalizeFieldValue(fields.fechaEnvasado, {
          formatAsDate: true,
        })
        const dateFontSize = 28 * scaleY
        const lotFontSize = 28 * scaleY
        const dateWidth = formattedDate ? measureTextWidth(formattedDate, dateFontSize, labelFont) : 0
        const lotWidth = measureTextWidth(lotText, lotFontSize, labelFont)
        const totalSpacing = formattedDate ? spacing : 0
        const combinedWidth = dateWidth + lotWidth + totalSpacing
        const startX = Math.max(60 * scaleX, desiredCenterX - combinedWidth / 2 - 40 * scaleX)
        let cursorX = startX

        if (formattedDate) {
          page.drawText(formattedDate, {
            x: cursorX,
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
        const weightFontSize = 70 * scaleY
        const weightWidth = measureTextWidth(weightText, weightFontSize, labelFont)
        const weightX = Math.max(60 * scaleX, desiredCenterX - weightWidth / 2)
        const weightY = lineY - 70 * scaleY
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
        const x = Math.max(60 * scaleX, desiredCenterX - textWidth / 2 + lotOffset)
        const y = isCilantro
          ? pageHeight / 2 - 40 * scaleY
          : isEneldo
          ? pageHeight / 2 - 25 * scaleY
          : isHierbahuerto
          ? pageHeight / 2 - 40 * scaleY
          : isPerejil
          ? pageHeight / 2 - 20 * scaleY
          : isRomero
          ? pageHeight / 2 - 25 * scaleY
          : pageHeight / 2 - 5 * scaleY
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
          const weightX = Math.max(60 * scaleX, desiredCenterX - weightWidth / 2 + weightOffset)
          const weightY = isEneldo
            ? y + 80 * scaleY
            : isPerejil
            ? y + 35 * scaleY
            : isHierbahuerto
            ? y + 55 * scaleY
            : isRomero
            ? y + 65 * scaleY
            : y + 55 * scaleY
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
  options?: { lines?: WhiteLabelLine[]; variantSuffix?: string },
): Promise<LabelRenderResult> {
  const config = WHITE_LABEL_CONFIGS[variant]
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([config.width, config.height])
  const labelFont = await resolveLabelFont(pdfDoc)
  const lines = options?.lines ?? buildWhiteLabelLines(variant, fields)
  let cursorY = config.height - config.margin

  for (const line of lines) {
    const fontSize = line.size ?? config.bodySize
    cursorY -= fontSize
    const y = Math.max(cursorY, config.margin / 2)
    page.drawText(line.text, {
      x: config.margin,
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
    options: { hideCodigoR: true, variantSuffix: 'lidl-principal' },
  })
  const summaryLines = buildLidlSummaryLines(fields)
  const summaryLabel = await renderWhiteLabelDocument(fields, fileName, 'blanca-grande', {
    lines: summaryLines,
    variantSuffix: 'lidl-peso',
  })
  const detailedLines = buildLidlDetailLines(fields)
  const detailedLabel = await renderWhiteLabelDocument(fields, fileName, 'blanca-grande', {
    lines: detailedLines,
    variantSuffix: 'lidl-info',
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

function normalizeSimpleKey(value?: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
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
