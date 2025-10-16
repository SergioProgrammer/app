import { readFile } from 'node:fs/promises'
import path from 'node:path'
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PDFDocument,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  scale,
  translate,
} from 'pdf-lib'

export interface LabelRenderFields {
  fechaEnvasado?: string | null
  lote?: string | null
  labelCode?: string | null
  codigoCoc?: string | null
  codigoR?: string | null
}

export interface LabelRenderResult {
  buffer: Buffer
  fileName: string
  mimeType: string
}

const DEFAULT_TEMPLATE_RELATIVE_PATH = path.join('public', 'Etiqueta.png')
const DEFAULT_FONT_SIZE = 56
const DEFAULT_FONT_COLOR = rgb(0, 0, 0)

interface LayoutEntry {
  baseX: number
  baseY: number
  fontSize?: number
  align?: 'left' | 'center' | 'right'
}

const BASE_WIDTH = 1262
const BASE_HEIGHT = 768

type LayoutKey = Exclude<keyof LabelRenderFields, 'labelCode'>

const TEXT_LAYOUT: Record<LayoutKey, LayoutEntry> = {
  fechaEnvasado: { baseX: 340, baseY: 440, align: 'left', fontSize: 36 },
  lote: { baseX: 230, baseY: 500, align: 'left', fontSize: 36 },
  codigoCoc: { baseX: 220, baseY: 630, align: 'left', fontSize: 36 },
  codigoR: { baseX: 1035, baseY: 415, align: 'left', fontSize: 28 },
}

const WEIGHT_LAYOUT: LayoutEntry = {
  baseX: 250,
  baseY: 570,
  align: 'left',
  fontSize: 38,
}

const BARCODE_NUMBER_LAYOUT = {
  baseX: 690,
  baseY: 670,
  fontSize: 38,
  align: 'center' as const,
}

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
  const templateBuffer = await loadTemplate(templatePath)
  const pdfDoc = await PDFDocument.create()
  const pngImage = await pdfDoc.embedPng(templateBuffer)
  const page: any = pdfDoc.addPage([pngImage.width, pngImage.height])

  const scaleX = pngImage.width / BASE_WIDTH
  const scaleY = pngImage.height / BASE_HEIGHT

  const pageProtoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(page))

  if (process.env.NODE_ENV !== 'production') {
    console.log('[label-renderer] page prototype keys:', pageProtoKeys)
  }

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

  (Object.keys(TEXT_LAYOUT) as LayoutKey[]).forEach((key: LayoutKey) => {
    const value = normalizeFieldValue(fields[key])
    if (!value) return

    const layout = TEXT_LAYOUT[key]
    const fontSize = (layout.fontSize ?? DEFAULT_FONT_SIZE) * scaleY
    const textWidth = approximateTextWidth(value, fontSize)

    const x = resolvePosition(layout.baseX * scaleX, layout.align, textWidth)
    const y = pngImage.height - layout.baseY * scaleY

    if (typeof page.drawText === 'function') {
      page.drawText(value, {
        x,
        y,
        size: fontSize,
        color: DEFAULT_FONT_COLOR,
      })
    }
  })

  const barcodeText = normalizeFieldValue(fields.labelCode ?? fields.codigoCoc)
  if (barcodeText && typeof page.drawText === 'function') {
    const layout = BARCODE_NUMBER_LAYOUT
    const fontSize = (layout.fontSize ?? DEFAULT_FONT_SIZE) * scaleY
    const textWidth = approximateTextWidth(barcodeText, fontSize)
    const x = resolvePosition(layout.baseX * scaleX, layout.align, textWidth)
    const y = pngImage.height - layout.baseY * scaleY

    page.drawText(barcodeText, {
      x,
      y,
      size: fontSize,
      color: DEFAULT_FONT_COLOR,
    })
  }

  if (typeof page.drawText === 'function') {
    const layout = WEIGHT_LAYOUT
    const fontSize = (layout.fontSize ?? DEFAULT_FONT_SIZE) * scaleY
    const weightText = '40gr'
    const textWidth = approximateTextWidth(weightText, fontSize)
    const x = resolvePosition(layout.baseX * scaleX, layout.align, textWidth)
    const y = pngImage.height - layout.baseY * scaleY

    page.drawText(weightText, {
      x,
      y,
      size: fontSize,
      color: DEFAULT_FONT_COLOR,
    })
  }

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: buildLabelFileName(fileName),
    mimeType: 'application/pdf',
  }
}

async function loadTemplate(customPath?: string): Promise<Buffer> {
  const resolvedPath = path.isAbsolute(customPath ?? '')
    ? customPath!
    : path.join(process.cwd(), customPath ?? DEFAULT_TEMPLATE_RELATIVE_PATH)

  if (!cachedTemplateBuffer || cachedTemplatePath !== resolvedPath) {
    cachedTemplateBuffer = await readFile(resolvedPath)
    cachedTemplatePath = resolvedPath
  }
  return cachedTemplateBuffer
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

function normalizeFieldValue(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}.${month}.${year.slice(-2)}`
  }
  return trimmed.toUpperCase()
}

function approximateTextWidth(text: string, fontSize: number): number {
  const averageCharWidth = fontSize * 0.6
  return text.length * averageCharWidth
}

function buildLabelFileName(originalFileName: string): string {
  const withoutExtension = originalFileName.replace(/\.[^/.]+$/u, '')
  const sanitized =
    withoutExtension.length > 0 ? withoutExtension : `etiqueta-${Date.now().toString(36)}`
  return `${sanitized}-etiqueta.pdf`
}
