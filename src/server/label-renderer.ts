import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
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

type LayoutKey = Exclude<keyof LabelRenderFields, 'labelCode' | 'weight'>

const TEXT_OFFSETS: Partial<Record<LayoutKey, { dx?: number; dy?: number }>> = {
  fechaEnvasado: { dx: 18, dy: -8 },
  lote: { dx: 42, dy: -25 },
  codigoR: { dx: -15, dy: -70 },
}

const TEXT_LAYOUT: Record<LayoutKey, LayoutEntry> = {
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

let cachedTemplateBuffer: Buffer | null = null
let cachedTemplatePath: string | null = null

export async function renderLabelPdf({
  fields,
  fileName,
  templatePath,
}: {
  fields: LabelRenderFields
  fileName: string
  templatePath?: string
}): Promise<LabelRenderResult> {
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

  (Object.keys(TEXT_LAYOUT) as LayoutKey[]).forEach((key: LayoutKey) => {
    if (key === 'codigoCoc') {
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

  if (typeof page.drawText === 'function') {
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

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: buildLabelFileName(fileName),
    mimeType: 'application/pdf',
  }
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
  const searchPaths = customPath ? [customPath] : DEFAULT_TEMPLATE_CANDIDATES
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

function buildLabelFileName(originalFileName: string): string {
  const withoutExtension = originalFileName.replace(/\.[^/.]+$/u, '')
  const sanitized =
    withoutExtension.length > 0 ? withoutExtension : `etiqueta-${Date.now().toString(36)}`
  return `${sanitized}-etiqueta.pdf`
}
