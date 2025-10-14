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
  codigoCoc?: string | null
  codigoR?: string | null
}

export interface LabelRenderResult {
  buffer: Buffer
  fileName: string
  mimeType: string
}

const DEFAULT_TEMPLATE_RELATIVE_PATH = path.join('public', 'Etiqueta.png')
const DEFAULT_FONT_SIZE = 26
const DEFAULT_FONT_COLOR = rgb(0, 0, 0)

type LayoutKey = keyof LabelRenderFields

interface LayoutEntry {
  x: number
  y: number
  fontSize?: number
  align?: 'left' | 'center' | 'right'
}

const TEXT_LAYOUT: Record<LayoutKey, LayoutEntry> = {
  fechaEnvasado: { x: 0.64, y: 0.33 },
  lote: { x: 0.64, y: 0.27 },
  codigoCoc: { x: 0.64, y: 0.21 },
  codigoR: { x: 0.64, y: 0.15 },
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
    const fontSize = layout.fontSize ?? DEFAULT_FONT_SIZE
    const textWidth = approximateTextWidth(value, fontSize)

    const x = resolvePosition(layout.x, pngImage.width, layout.align, textWidth)
    const y = layout.y * pngImage.height

    if (typeof page.drawText === 'function') {
      page.drawText(value, {
        x,
        y,
        size: fontSize,
        color: DEFAULT_FONT_COLOR,
      })
    }
  })

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
  relativeX: number,
  totalWidth: number,
  align: LayoutEntry['align'],
  textWidth: number,
): number {
  const absoluteX = totalWidth * clamp(relativeX, 0, 1)
  if (align === 'center') {
    return absoluteX - textWidth / 2
  }
  if (align === 'right') {
    return absoluteX - textWidth
  }
  return absoluteX
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeFieldValue(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
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
