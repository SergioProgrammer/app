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
  type PDFPage,
} from 'pdf-lib'
import type { LabelRenderFields, LabelRenderResult, WhiteLabelLine } from '../label-types'
import {
  DEFAULT_FONT_COLOR,
  WHITE_LABEL_ORIGIN_LINE,
  drawEan13Barcode,
  formatLotText,
  formatProductText,
  formatVarietyText,
  formatWeightText,
  mmToPageX,
  mmToPageYDelta,
  normalizeFieldValue,
  normalizeTemplateKey,
  renderLabelPdf,
  renderWhiteLabelDocument,
  resolveLabelFont,
  sanitizeBarcodeValue,
} from '../label-renderer'
import { renderCenteredNameWeightLabel, renderLidlCajaDetailLabel } from './lidl-renderer'

const ALDI_TEMPLATE_CANDIDATES = [
  path.join('public', 'Etiqueta-Aldi.pdf'),
  path.join('public', 'etiqueta-aldi.pdf'),
  path.join('public', 'Etiqueta_Aldi.pdf'),
]

const ALDI_SPECIAL_TEMPLATE_MAP: Record<string, string> = {
  acelgas: 'acelgasaldi.pdf',
  hojasfrescasacelga: 'acelgasaldi.pdf',
  albahaca: 'albahacasaldi.pdf',
  cebollino: 'cebollinosaldi.pdf',
  cilantro: 'cilantrosaldi.pdf',
  eneldo: 'eneldosaldi.pdf',
  pakchoi: 'pakchoialdi.pdf',
  hierbabuena: 'hierbahuertoaldi.pdf',
  hierbahuerto: 'hierbahuertoaldi.pdf',
  perejil: 'perejilaldi.pdf',
  romero: 'romeroaldi.pdf',
}

const ALDI_SPECIAL_LAYOUT = {
  acelgas: {
    loteXmm: 33.84,
    loteYmmFromBottom: 19,
    pesoXmm: 24,
    pesoOffset: 0.8,
    codeXmm: 15,
    codeYmmFromBottom: 18,
  },
  hojasfrescasacelga: {
    loteXmm: 33.84,
    loteYmmFromBottom: 19,
    pesoXmm: 24,
    pesoOffset: 0.8,
    codeXmm: 15,
    codeYmmFromBottom: 18,
  },
  albahaca: {
    loteXmm: 33.84,
    loteYmmFromBottom: 18.9,
    pesoXmm: 43,
    pesoOffset: 0.9,
    codeXmm: 15,
    codeYmmFromBottom: 18.9,
  },
  cebollino: {
    loteXmm: 34.84,
    loteYmmFromBottom: 11.48,
    pesoXmm: 44.22,
    pesoOffset: 1.8,
    codeXmm: 16,
    codeYmmFromBottom: 11.48,
  },
  cilantro: {
    loteXmm: 34.84,
    loteYmmFromBottom: 11.48,
    pesoXmm: 44.22,
    pesoOffset: 0.5,
    codeXmm: 16,
    codeYmmFromBottom: 11.48,
  },
  eneldo: {
    loteXmm: 34.84,
    loteYmmFromBottom: 11.48,
    pesoXmm: 44.22,
    pesoOffset: 0.5,
    codeXmm: 16,
    codeYmmFromBottom: 11.48,
  },
  hierbabuena: {
    loteXmm: 34.84,
    loteYmmFromBottom: 11.48,
    pesoXmm: 44.22,
    pesoOffset: 0.55,
    codeXmm: 16,
    codeYmmFromBottom: 11.48,
  },
  hierbahuerto: {
    loteXmm: 34.84,
    loteYmmFromBottom: 11.48,
    pesoXmm: 44.22,
    pesoOffset: 0.55,
    codeXmm: 16,
    codeYmmFromBottom: 11.48,
  },
  pakchoi: {
    loteXmm: 34.84,
    loteYmmFromBottom: 11.48,
    pesoXmm: 44.22,
    pesoOffset: 1.8,
    codeXmm: 16,
    codeYmmFromBottom: 11.48,
  },
  perejil: {
    loteXmm: 36,
    loteYmmFromBottom: 11.6,
    pesoXmm: 44.22,
    pesoOffset: 0.55,
    codeXmm: 15.2,
    codeYmmFromBottom: 11.48,
  },
  romero: {
    loteXmm: 38.6,
    loteYmmFromBottom: 11.6,
    pesoXmm: 44.22,
    pesoOffset: 0.9,
    codeXmm: 14,
    codeYmmFromBottom: 11.48,
  },
} as const

const ALDI_TRACE_PREFIX = 'E'
const ALDI_TRACE_LENGTH = 5

function isAldiSpecialKey(normalizedKey: string): boolean {
  return Boolean(ALDI_SPECIAL_TEMPLATE_MAP[normalizedKey])
}

function resolveAldiTemplatePath(customPath?: string | null, productName?: string | null): string | undefined {
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

export async function renderAldiLabelSet({
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
  })
  const summaryLabel = await renderCenteredNameWeightLabel(fields, fileName, {
    variantSuffix: 'aldi-10x5-peso',
  })
  const detailedLabel = await renderLidlCajaDetailLabel(fields, fileName, {
    variantSuffix: 'aldi-10x5-detalle',
    brandLabel: 'Aldi',
  })
  return [baseLabel, summaryLabel, detailedLabel]
}

export async function renderAldiLabel({
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
    console.error('[aldi-renderer] Aldi template load failed, using fallback white label:', error)
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
    const layout =
      ALDI_SPECIAL_LAYOUT[normalizedProductKey as keyof typeof ALDI_SPECIAL_LAYOUT] ??
      ALDI_SPECIAL_LAYOUT['hojasfrescasacelga']
    const loteY = mmToPageYDelta(layout.loteYmmFromBottom, pageHeight)
    const pesoY = loteY + bodySize * layout.pesoOffset
    const leftX = mmToPageX(layout.loteXmm, pageWidth)
    const rightX = mmToPageX(layout.pesoXmm, pageWidth)
    const codeX = mmToPageX(layout.codeXmm, pageWidth)
    const codeY = mmToPageYDelta(layout.codeYmmFromBottom, pageHeight)

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

function buildAldiFallbackLines(fields: LabelRenderFields): WhiteLabelLine[] {
  const lote = normalizeAldiLotValue(fields.lote) ?? formatLotText(fields.lote)
  const codigoE =
    normalizeAldiTraceValue(fields.codigoR) ??
    normalizeAldiTraceValue(fields.lote) ??
    formatLotText(fields.codigoR) ??
    'SIN CODIGO'
  const peso = formatWeightText(fields.weight)
  const coc =
    normalizeFieldValue(fields.codigoCoc, { preserveFormat: true }) ??
    WHITE_LABEL_ORIGIN_LINE.split('CoC:').pop()?.trim() ??
    '4063061581198'
  return [
    { text: `LOTE ALDI: ${lote}` },
    { text: `CÓDIGO E: ${codigoE}` },
    { text: `PESO: ${peso}` },
    { text: `COC: ${coc}` },
  ]
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
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const [, rawWeek, rawDay] = match
  const week = rawWeek.padStart(2, '0')
  const day = rawDay.padStart(2, '0')
  return `${week}/${day}`
}
