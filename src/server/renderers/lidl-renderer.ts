import {
  DEFAULT_FONT_COLOR,
  buildLabelFileName,
  formatLotText,
  formatProductText,
  formatVarietyText,
  formatWeightText,
  formatWhiteLabelDate,
  renderLabelPdf,
  resolveLabelFont,
  sanitizeBarcodeValue,
} from '../label-renderer'
import type { LabelRenderFields, LabelRenderResult } from '../label-types'
import { PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib'

const LIDL_CENTERED_10X5_CONFIG = {
  width: 720,
  height: 360,
  margin: 36,
  lineSpacing: 28,
  titleSize: 38,
  bodySize: 26,
  smallSize: 20,
} as const

function measureTextWidth(text: string, fontSize: number, font: PDFFont): number {
  return font.widthOfTextAtSize(text, fontSize)
}

export async function renderCenteredNameWeightLabel(
  fields: LabelRenderFields,
  fileName: string,
  options?: { variantSuffix?: string },
): Promise<LabelRenderResult> {
  const config = LIDL_CENTERED_10X5_CONFIG
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([config.width, config.height])
  const font = await resolveLabelFont(pdfDoc)
  const text = `${formatProductText(fields.productName)} ${formatWeightText(fields.weight)}`
  const size = config.titleSize + 4
  const textWidth = measureTextWidth(text, size, font)
  const x = Math.max(config.margin, (config.width - textWidth) / 2)
  const y = config.height / 2 + size / 2
  const color = DEFAULT_FONT_COLOR
  const boldOffsets: Array<[number, number]> = [
    [0, 0],
    [0.4, 0],
    [0, 0.4],
  ]

  boldOffsets.forEach(([dx, dy]) => {
    page.drawText(text, {
      x: x + dx,
      y: y + dy,
      size,
      font,
      color,
    })
  })

  const underlineY = y - size * 0.2
  const underlineStart = Math.max(config.margin, x - size * 0.1)
  const underlineEnd = Math.min(config.width - config.margin, x + textWidth + size * 0.1)
  const rawPage = page as unknown as PDFPage & {
    drawLine?: (options: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color: typeof DEFAULT_FONT_COLOR }) => void
  }
  if (typeof rawPage.drawLine === 'function') {
    rawPage.drawLine({
      start: { x: underlineStart, y: underlineY },
      end: { x: underlineEnd, y: underlineY },
      thickness: 2,
      color,
    })
  } else {
    const thickness = 2
    page.drawRectangle({
      x: underlineStart,
      y: underlineY - thickness / 2,
      width: underlineEnd - underlineStart,
      height: thickness,
      color,
    })
  }

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: buildLabelFileName(fileName, options?.variantSuffix, fields.lote),
    mimeType: 'application/pdf',
  }
}

export async function renderLidlCajaDetailLabel(
  fields: LabelRenderFields,
  fileName: string,
  options?: { variantSuffix?: string; brandLabel?: string },
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
    page.drawText(label, {
      x: x + 8,
      y: y - labelSize - 6,
      size: labelSize,
      font,
      color: DEFAULT_FONT_COLOR,
    })
    page.drawText(value, {
      x: x + 8,
      y: y - valSize - labelSize - 10,
      size: valSize,
      font,
      color: DEFAULT_FONT_COLOR,
    })
  }

  const formattedDate = formatWhiteLabelDate(fields.fechaEnvasado)
  const lotText = formatLotText(fields.lote)
  const product = formatProductText(fields.productName)
  const weight = formatWeightText(fields.weight)
  const brandLabel = options?.brandLabel ?? 'Lidl'

  // Marca / producto arriba
  drawBox({
    x: padding,
    y: startY,
    w: fullWidth,
    h: topRowHeight,
    label: `Marca: ${brandLabel}`,
    value: product,
    valueSize: 24,
  })
  let cursorY = startY - topRowHeight

  // Fecha / Lote
  drawBox({
    x: padding,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'FECHA',
    value: formattedDate,
    valueSize: 16,
  })
  drawBox({
    x: padding + halfWidth,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'LOTE',
    value: lotText,
    valueSize: 16,
  })
  cursorY -= rowHeight

  // Peso / EAN
  drawBox({
    x: padding,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'PESO',
    value: weight,
    valueSize: 22,
  })
  drawBox({
    x: padding + halfWidth,
    y: cursorY,
    w: halfWidth,
    h: rowHeight,
    label: 'EAN',
    value: fields.labelCode ? sanitizeBarcodeValue(fields.labelCode) ?? '' : '',
    valueSize: 16,
  })
  cursorY -= rowHeight

  // Nombre cliente (usamos variedad o vacío)
  const customerName = formatVarietyText(fields.variety)
  const customerValue = customerName.length > 0 ? customerName : '-'
  drawBox({
    x: padding,
    y: cursorY,
    w: fullWidth,
    h: rowHeight,
    label: 'CLIENTE',
    value: customerValue,
    valueSize: 18,
  })
  cursorY -= rowHeight

  // Agencia / lote etc
  const agenciaCodigo = 'MRH'
  const brandLabelLower = brandLabel.toLowerCase()
  const unitWeight = formatWeightText(fields.weight)
  const units = brandLabelLower === 'aldi' ? '2 uds' : '1 ud'
  const labelId = formatLotText(fields.lote)
  const valueSuffix = brandLabelLower === 'aldi' ? '· 35010' : ''
  const value = `${agenciaCodigo} · ${units} · ${unitWeight} · ${labelId}${valueSuffix ? ` ${valueSuffix}` : ''}`
  drawBox({
    x: padding,
    y: cursorY,
    w: fullWidth,
    h: rowHeight,
    label: 'AGENCIA',
    value,
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
    value: sanitizeBarcodeValue(fields.labelCode) ?? '',
    valueSize: 16,
  })
  drawBox({
    x: padding + halfWidth,
    y: cursorY,
    w: halfWidth,
    h: miniRowHeight,
    label: 'PESO / FECHA',
    value: `${weight} · ${formattedDate}`,
    valueSize: 14,
  })

  const pdfBytes = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: buildLabelFileName(fileName, options?.variantSuffix, fields.lote),
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
  const summaryLabel = await renderCenteredNameWeightLabel(fields, fileName, {
    variantSuffix: 'lidl-10x5-peso',
  })
  const detailedLabel = await renderLidlCajaDetailLabel(fields, fileName, {
    variantSuffix: 'lidl-10x5-detalle',
  })
  return [baseLabel, summaryLabel, detailedLabel]
}
