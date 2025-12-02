import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  PDFDocument,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  scale,
  translate,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import type { LabelRenderFields, LabelRenderResult, WhiteLabelLine } from '../label-types'

const KANALI_TEMPLATE_CANDIDATES = [
  path.join('public', 'Etiqueta-Kanali.pdf'),
  path.join('public', 'etiqueta-kanali.pdf'),
  path.join('public', 'Etiqueta_Kanali.pdf'),
]

const KANALI_SPECIAL_TEMPLATE_MAP: Record<string, string> = {
  albahaca: 'albahacakanali.pdf',
  cebollino: 'cebollinokanali.pdf',
  cilantro: 'cilantrokanali.pdf',
  hierbahuerto: 'hierbahuertokanali.pdf',
  perejil: 'perejilkanali.pdf',
  romero: 'romerokanali.pdf',
  rucula: 'ruculakanali.pdf',
}

const KANALI_SPECIAL_LAYOUT = {
  cilantro: {
    codeYmmFromBottom: 19,
    loteYmmFromBottom: 19,
    loteXmm: 33,
    codeXmm: 15,
    pesoXmm: 20,
    pesoOffset: 3,
  },
  romero: {
    codeYmmFromBottom: 20.5,
    loteYmmFromBottom: 20.5,
    loteXmm: 33,
    codeXmm: 15,
    pesoXmm: 25.5,
    pesoOffset: 3,
  },
  albahaca: {
    codeYmmFromBottom: 18.5,
    loteYmmFromBottom: 18.5,
    loteXmm: 30,
    codeXmm: 14,
    pesoXmm: 11,
    pesoOffset: 3,
  },
  rucula: {
    codeYmmFromBottom: 20.5,
    loteYmmFromBottom: 20.5,
    loteXmm: 33,
    codeXmm: 15,
    pesoXmm: 25.5,
    pesoOffset: 3,
  },
  cebollino: {
    codeYmmFromBottom: 21,
    loteYmmFromBottom: 21,
    loteXmm: 33,
    codeXmm: 15,
    pesoXmm: 25.5,
    pesoOffset: 3,
  },
  perejil: {
    codeYmmFromBottom: 19,
    loteYmmFromBottom: 19,
    loteXmm: 33,
    codeXmm: 15,
    pesoXmm: 19.5,
    pesoOffset: 3,
  },
  hierbahuerto: {
    codeYmmFromBottom: 19,
    loteYmmFromBottom: 19,
    loteXmm: 33,
    codeXmm: 15,
    pesoXmm: 19.5,
    pesoOffset: 3,
  },
} as const

const ALDI_LOT_PATTERN = /^(\d{1,2})\/(\d{1,2})$/

export interface KanaliRenderDeps {
  formatProductText: (value?: string | null) => string
  formatVarietyText: (value?: string | null) => string
  formatWeightText: (value?: string | null) => string
  formatLotText: (value?: string | null) => string
  normalizeFieldValue: (value?: string | null, options?: { preserveFormat?: boolean; formatAsDate?: boolean }) => string | null
  resolveLabelFont: (pdfDoc: PDFDocument) => Promise<PDFFont>
  DEFAULT_FONT_COLOR: RGB
  WHITE_LABEL_ORIGIN_LINE: string
  normalizeTemplateKey: (value: string) => string
  mmToPageX: (mm: number, pageWidth: number) => number
  mmToPageYDelta: (mm: number, pageHeight: number) => number
  buildLabelFileName: (originalFileName: string, variantSuffix?: string, lot?: string | null) => string
  drawEan13Barcode: (
    page: PDFPage,
    code: string,
    options: { x: number; y: number; width: number; height: number; font: PDFFont },
  ) => void
  sanitizeBarcodeValue: (value?: string | null) => string | null
}

function normalizeTemplateKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function resolveKanaliTemplatePath(customPath?: string | null, productName?: string | null): string | undefined {
  const productCandidates: string[] = []
  if (productName) {
    const key = normalizeTemplateKey(productName)
    if (KANALI_SPECIAL_TEMPLATE_MAP[key]) {
      productCandidates.push(path.join(process.cwd(), 'public', KANALI_SPECIAL_TEMPLATE_MAP[key]))
    }
    const suffixes = ['-kanali.pdf', '_kanali.pdf', '-kanali-template.pdf', '-kanali_etiqueta.pdf', 'kanali.pdf']
    for (const suffix of suffixes) {
      productCandidates.push(path.join(process.cwd(), 'public', `${key}${suffix}`))
    }
  }
  const candidates = [
    customPath ?? null,
    ...productCandidates,
    ...KANALI_TEMPLATE_CANDIDATES,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)

  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate)
    if (existsSync(resolved)) {
      return resolved
    }
  }

  return undefined
}

export async function renderKanaliLabel({
  fields,
  fileName,
  templatePath,
  shared,
}: {
  fields: LabelRenderFields
  fileName: string
  templatePath?: string
  shared: KanaliRenderDeps
}): Promise<LabelRenderResult> {
  const preferredTemplate = resolveKanaliTemplatePath(templatePath, fields.productName)
  if (!preferredTemplate) {
    throw new Error('No encontramos plantilla específica para Kanali.')
  }
  const resolvedPath = path.isAbsolute(preferredTemplate)
    ? preferredTemplate
    : path.join(process.cwd(), preferredTemplate)
  console.info('[kanali-renderer] template', { resolvedPath })
  const templateBuffer = await readFile(resolvedPath)

  const templateExtension = path.extname(resolvedPath).toLowerCase()
  const pdfDoc = await PDFDocument.create()
  const labelFont = await shared.resolveLabelFont(pdfDoc)

  let page: PDFPage
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

    const rawPage = page as unknown as {
      drawImage?: (img: unknown, opts: unknown) => void
      node?: { newXObject: (name: string, ref: unknown) => unknown }
      pushOperators?: (...ops: unknown[]) => void
    }
    if (typeof rawPage.drawImage === 'function') {
      rawPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height,
      })
    } else {
      const imageName = rawPage.node?.newXObject(`Im-${Date.now().toString(36)}`, pngImage.ref) as
        | Parameters<typeof drawObject>[0]
        | undefined
      if (imageName) {
        rawPage.pushOperators?.(
          pushGraphicsState(),
          translate(0, 0),
          scale(pngImage.width, pngImage.height),
          drawObject(imageName),
          popGraphicsState(),
        )
      }
    }
  }

  let weight = shared.formatWeightText(fields.weight)
  const fechaEnvasado =
    shared.normalizeFieldValue(fields.fechaEnvasado, { formatAsDate: true }) ?? 'SIN FECHA'
  const loteKanali = formatKanaliLot(fields.lote, fields.fechaEnvasado, shared.formatLotText)
  const normalizedProductKey = shared.normalizeTemplateKey(fields.productName ?? '')
  const isKanaliCilantro = normalizedProductKey.includes('cilantro')
  const layoutProductKey = isKanaliCilantro ? 'cilantro' : normalizedProductKey
  const kanaliLayout = KANALI_SPECIAL_LAYOUT[layoutProductKey as keyof typeof KANALI_SPECIAL_LAYOUT]
  if (!kanaliLayout) {
    throw new Error('No hay layout definido para este producto Kanali.')
  }
  const isDefaultWeight = weight.toLowerCase() === '40gr'
  if (layoutProductKey === 'cilantro' && (isDefaultWeight || !fields.weight)) {
    weight = '50gr'
  }
  console.info('[kanali-renderer] usando layout Kanali', {
    layoutProductKey,
    kanaliLayout,
    page: { width: pageWidth, height: pageHeight },
  })
  const bodySize = Math.max(4.5, Math.min(5.5, pageWidth * 0.0038))
  const loteY = shared.mmToPageYDelta(kanaliLayout.loteYmmFromBottom, pageHeight)
  const pesoY = loteY + bodySize * kanaliLayout.pesoOffset
  const leftX = shared.mmToPageX(kanaliLayout.loteXmm, pageWidth)
  const rightX = shared.mmToPageX(kanaliLayout.pesoXmm, pageWidth)
  const codeX = shared.mmToPageX(kanaliLayout.codeXmm, pageWidth)
  const codeY = shared.mmToPageYDelta(kanaliLayout.codeYmmFromBottom, pageHeight)
  console.info('[kanali-renderer] posiciones calculadas', {
    lote: { x: leftX, y: loteY },
    peso: { x: rightX, y: pesoY },
    code: { x: codeX, y: codeY },
    bodySize,
  })

  page.drawText(loteKanali, {
    x: leftX,
    y: loteY,
    size: bodySize + 1,
    font: labelFont,
    color: shared.DEFAULT_FONT_COLOR,
  })
  page.drawText(fechaEnvasado, {
    x: codeX,
    y: codeY,
    size: bodySize + 1,
    font: labelFont,
    color: shared.DEFAULT_FONT_COLOR,
  })
  page.drawText(weight, {
    x: rightX,
    y: pesoY,
    size: bodySize + 1,
    font: labelFont,
    color: shared.DEFAULT_FONT_COLOR,
  })

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: shared.buildLabelFileName(fileName, undefined, fields.lote),
    mimeType: 'application/pdf',
  }
}

export function buildKanaliFallbackLines(
  fields: LabelRenderFields,
  shared: Pick<KanaliRenderDeps, 'normalizeFieldValue' | 'formatWeightText' | 'formatLotText'>,
): WhiteLabelLine[] {
  const lote = formatKanaliLot(fields.lote, fields.fechaEnvasado, shared.formatLotText)
  const fecha = shared.normalizeFieldValue(fields.fechaEnvasado, { formatAsDate: true }) ?? 'SIN FECHA'
  const peso = shared.formatWeightText(fields.weight)
  return [
    { text: `LOTE KANALI: ${lote}` },
    { text: `FECHA ENVASADO: ${fecha}` },
    { text: `PESO: ${peso}` },
  ]
}

function formatKanaliLot(value?: string | null, fechaEnvasado?: string | null, formatLotText?: (v?: string | null) => string): string {
  const fromDate = buildWeekDayLotFromDate(fechaEnvasado)
  if (fromDate) {
    return fromDate
  }
  const normalizedWithSlash = normalizeAldiLotValue(value)
  if (normalizedWithSlash) {
    return normalizedWithSlash
  }
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : ''
  if (digits.length >= 3 && digits.length <= 4) {
    const padded = digits.padStart(4, '0')
    const week = padded.slice(0, padded.length - 2).padStart(2, '0')
    const day = padded.slice(-2)
    return `${week}/${day}`
  }
  return formatLotText ? formatLotText(value) : 'SIN LOTE'
}

function buildWeekDayLotFromDate(fechaEnvasado?: string | null): string | null {
  const parsed = parseDateFlexible(fechaEnvasado)
  if (!parsed) return null
  const week = getIsoWeekNumber(parsed)
  const day = parsed.getUTCDate().toString().padStart(2, '0')
  return `${week.toString().padStart(2, '0')}/${day}`
}

function parseDateFlexible(value?: string | null): Date | null {
  const iso = parseIsoDate(value)
  if (iso) return iso
  if (!value) return null
  const trimmed = value.trim()
  const localeMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (!localeMatch) return null
  const [, day, month, rawYear] = localeMatch
  const year = rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear)
  const parsed = new Date(Date.UTC(year, Number(month) - 1, Number(day)))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
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

function getIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.getTime()
  const firstThursdayOfYear = new Date(Date.UTC(target.getUTCFullYear(), 0, 4)).getTime()
  return 1 + Math.round((firstThursday - firstThursdayOfYear) / (7 * 24 * 60 * 60 * 1000))
}

function normalizeAldiLotValue(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const match = trimmed.match(ALDI_LOT_PATTERN)
  if (!match) return null
  const [, rawWeek, rawDay] = match
  const week = rawWeek.padStart(2, '0')
  const day = rawDay.padStart(2, '0')
  return `${week}/${day}`
}
