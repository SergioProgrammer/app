import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export interface InvoiceParty {
  name: string
  taxId: string
  address: string
  city?: string
  country?: string
  extra?: string
}

export interface InvoiceBankInfo {
  bankName: string
  iban: string
  swift: string
}

export interface InvoiceItem {
  product: string
  netWeightKg: number
  pricePerKg: number
  bundles?: number
  total?: number
}

export interface InvoicePayload {
  invoiceNumber: string
  invoiceDate: string
  emitter: InvoiceParty
  receiver: InvoiceParty
  incoterm?: string
  destination?: string
  ggnOrCoc?: string
  paymentTerms?: string
  bankInfo?: InvoiceBankInfo
  items: InvoiceItem[]
  igicRate?: number
  totals?: {
    totalKg?: number
    totalBundles?: number
  }
  grossWeight?: number
  netWeight?: number
  awb?: string
  flightNumber?: string
  destinationFinal?: string
  finalConsignee?: string
}

const FONT_SIZE = {
  heading: 12,
  label: 8,
  body: 9,
  table: 9,
  small: 8,
} as const

function formatCurrency(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatNumber(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const rounded = Number(value.toFixed(2))
  const isWhole = Number.isInteger(rounded)
  return rounded.toLocaleString(
    'es-ES',
    isWhole ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )
}

function formatDate(value: string): string {
  if (!value) return ''
  return value
}

function wrapText(line: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const words = line.split(/\s+/)
  const lines: string[] = []
  let current = ''
  words.forEach((word) => {
    const candidate = current.length === 0 ? word : `${current} ${word}`
    const width = font.widthOfTextAtSize(candidate, size)
    if (width <= maxWidth || current.length === 0) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  })
  if (current.length > 0) {
    lines.push(current)
  }
  return lines
}

async function embedLogo(pdfDoc: PDFDocument): Promise<{ width: number; height: number; bytes: Uint8Array } | null> {
  try {
    const baseUrl =
      typeof window !== 'undefined'
        ? ''
        : process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL
        : ''
    const url = `${baseUrl}/logos/logoycoward.png`
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const png = await pdfDoc.embedPng(buffer)
    const dims = png.scale(0.34)
    return { width: dims.width, height: dims.height, bytes: new Uint8Array(buffer) }
  } catch {
    return null
  }
}

export async function generateInvoicePdf(payload: InvoicePayload): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const outerMargin = (15 / 25.4) * 72 // 1.5 cm
  const margin = outerMargin
  const topY = height - margin

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; bold?: boolean },
  ) => {
    page.drawText(text, {
      x,
      y,
      size: options?.size ?? FONT_SIZE.body,
      font: options?.bold ? boldFont : font,
      color: rgb(0, 0, 0),
    })
  }

  const drawLabelValue = (label: string, value: string, x: number, y: number, widthBox: number) => {
    drawText(label, x, y, { size: FONT_SIZE.small, bold: true })
    drawText(value, x, y - 12, { size: FONT_SIZE.body })
    // underline area
    page.drawLine({
      start: { x, y: y - 16 },
      end: { x: x + widthBox, y: y - 16 },
      thickness: 0.5,
      color: rgb(0.2, 0.2, 0.2),
    })
  }

  let cursorY = topY

  // Header emitter + receiver
  // Logo
  const logo = await embedLogo(pdfDoc)
  if (logo) {
    const logoImg = await pdfDoc.embedPng(logo.bytes)
    page.drawImage(logoImg, {
      x: margin,
      y: topY - logo.height,
      width: logo.width,
      height: logo.height,
    })
  }

  const headerTextX = margin + 80
  drawText(payload.emitter.name, headerTextX, cursorY, { size: 11, bold: true })
  cursorY -= 13
  const emitterLines = [
    payload.emitter.taxId,
    payload.emitter.address,
    [payload.emitter.city, payload.emitter.country].filter(Boolean).join(' · '),
    payload.emitter.extra,
  ].filter(Boolean)
  const receiverWidth = 210
  const receiverHeight = 110
  const receiverX = width - margin - receiverWidth
  const receiverTop = topY - 6
  const emitterMaxWidth = receiverX - headerTextX - 16
  emitterLines.forEach((line) => {
    const wrapped = wrapText(line ?? '', emitterMaxWidth, font, FONT_SIZE.body)
    wrapped.forEach((wrappedLine) => {
      drawText(wrappedLine, headerTextX, cursorY, { size: FONT_SIZE.body })
      cursorY -= FONT_SIZE.body + 3
    })
  })
  const emitterBottomY = cursorY

  // Receiver box
  const receiverPadding = 10
  const receiverNameLines = wrapText(payload.receiver.name, receiverWidth - receiverPadding * 2, boldFont, FONT_SIZE.body)
  const receiverBodyLines = [
    payload.receiver.taxId,
    payload.receiver.address,
    payload.receiver.city,
    payload.receiver.country,
    payload.receiver.extra,
  ]
    .filter(Boolean)
    .flatMap((line) => wrapText(line ?? '', receiverWidth - receiverPadding * 2, font, FONT_SIZE.small))
  const receiverLineHeight = FONT_SIZE.body + 3
  const receiverBodyLineHeight = FONT_SIZE.small + 3
  const computedReceiverHeight =
    receiverPadding * 2 +
    receiverNameLines.length * receiverLineHeight +
    receiverBodyLines.length * receiverBodyLineHeight
  const receiverBoxHeight = Math.max(receiverHeight, computedReceiverHeight)

  page.drawRectangle({
    x: receiverX,
    y: receiverTop - receiverBoxHeight,
    width: receiverWidth,
    height: receiverBoxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  let receiverCursorY = receiverTop - receiverPadding - FONT_SIZE.body
  receiverNameLines.forEach((line) => {
    drawText(line, receiverX + receiverPadding, receiverCursorY, {
      size: FONT_SIZE.body,
      bold: true,
    })
    receiverCursorY -= receiverLineHeight
  })
  receiverBodyLines.forEach((line) => {
    drawText(line, receiverX + receiverPadding, receiverCursorY, { size: FONT_SIZE.small })
    receiverCursorY -= receiverBodyLineHeight
  })

  // Invoice data box
  const invoiceBoxHeight = 48
  const invoiceBoxWidth = 230
  const invoiceTop = Math.min(emitterBottomY, receiverTop - receiverBoxHeight - 4) + 22
  const invoiceBoxY = invoiceTop - invoiceBoxHeight
  page.drawRectangle({
    x: margin,
    y: invoiceBoxY,
    width: invoiceBoxWidth,
    height: invoiceBoxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  const invoiceLabelY = invoiceTop - 14
  drawText('FACTURA / INVOICE', margin + 8, invoiceLabelY, { size: 9, bold: true })

  const numberBox = { x: margin + 8, y: invoiceBoxY + 10, w: 110, h: 18 }
  page.drawRectangle({ x: numberBox.x, y: numberBox.y, width: numberBox.w, height: numberBox.h, borderColor: rgb(0, 0, 0), borderWidth: 1 })
  drawText(payload.invoiceNumber, numberBox.x + 6, numberBox.y + 5, { size: 9 })

  const dateBox = { x: numberBox.x + numberBox.w + 12, y: numberBox.y, w: 70, h: 18 }
  page.drawRectangle({ x: dateBox.x, y: dateBox.y, width: dateBox.w, height: dateBox.h, borderColor: rgb(0, 0, 0), borderWidth: 1 })
  drawText('FECHA', dateBox.x + 2, invoiceLabelY, { size: 9, bold: true })
  drawText(formatDate(payload.invoiceDate), dateBox.x + 6, dateBox.y + 5, { size: 9 })

  cursorY = invoiceBoxY - 6

  // Destination / Incoterm
  cursorY -= 6
  drawLabelValue('DESTINO / DESTINATION', payload.destination || '—', margin, cursorY, 220)
  drawLabelValue('INCOTERM', payload.incoterm || '—', margin + 240, cursorY, 140)
  cursorY -= 20

  // Table header
  const colWidths = [200, 80, 80, 70, 90]
  const colTitlesTop = ['PRODUCTO', 'Peso Neto', 'Precio/Kg (€)', 'Bultos', 'Importe']
  const colTitlesBottom = ['PRODUCT', 'Kg Net', 'Price kg (€)', 'Bundles', 'Total due']
  const tableX = margin
  const tableY = cursorY
  const rowHeight = 24

  // Header background
  page.drawRectangle({
    x: tableX,
    y: tableY - rowHeight,
    width: colWidths.reduce((a, b) => a + b, 0),
    height: rowHeight,
    color: rgb(0.9, 0.9, 0.9),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  let cursorX = tableX + 6
  colTitlesTop.forEach((title, idx) => {
    drawText(title, cursorX, tableY - 9, { size: 9, bold: true })
    drawText(colTitlesBottom[idx], cursorX, tableY - 19, { size: 8 })
    cursorX += colWidths[idx]
  })
  cursorY -= rowHeight

  // Rows
  payload.items.forEach((item) => {
    cursorY -= rowHeight
    if (cursorY < margin + 120) {
      drawText('...', tableX, cursorY, { size: FONT_SIZE.body })
      return
    }
    page.drawRectangle({
      x: tableX,
      y: cursorY,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: rowHeight,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.5,
    })
    const rowValues = [
      item.product,
      item.netWeightKg?.toLocaleString('es-ES'),
      item.pricePerKg?.toLocaleString('es-ES', { minimumFractionDigits: 2 }),
      item.bundles?.toLocaleString('es-ES') ?? '',
      formatCurrency(item.total ?? item.netWeightKg * item.pricePerKg),
    ]
    cursorX = tableX + 6
    rowValues.forEach((value, idx) => {
      drawText(String(value ?? ''), cursorX, cursorY + 6, { size: FONT_SIZE.table })
      cursorX += colWidths[idx]
    })
  })
  cursorY -= rowHeight

  const totals = payload.items.reduce(
    (acc, item) => {
      acc.totalAmount += item.total ?? item.netWeightKg * item.pricePerKg
      acc.totalKg += item.netWeightKg || 0
      acc.totalBundles += item.bundles || 0
      return acc
    },
    { totalAmount: 0, totalKg: 0, totalBundles: 0 },
  )
  const igicRate = payload.igicRate ?? 0
  const igicAmount = totals.totalAmount * igicRate
  const totalDue = totals.totalAmount + igicAmount

  const blockWidth = colWidths.reduce((a, b) => a + b, 0)
  // GGN
  const ggnY = margin + 170
  if (payload.ggnOrCoc) {
    drawText(`GGN CERTIFIED / CoC_${payload.ggnOrCoc}`, tableX, ggnY, { size: 9 })
  }

  // Economic band
  const econHeight = 40
  const econY = ggnY - 55
  page.drawRectangle({ x: tableX, y: econY, width: blockWidth, height: econHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 })
  const econColWidth = blockWidth / 3
  drawText('SUMA IMPORTES / BASE IMPONIBLE', tableX + 8, econY + econHeight - 10, { size: 8, bold: true })
  drawText(formatCurrency(totals.totalAmount), tableX + 8, econY + econHeight - 24, { size: 9, bold: true })

  drawText(`IGIC: ${(igicRate * 100).toFixed(0)}%`, tableX + econColWidth + 8, econY + econHeight - 10, {
    size: 8,
    bold: true,
  })
  drawText(formatCurrency(igicAmount), tableX + econColWidth + 8, econY + econHeight - 24, { size: 9 })

  drawText('TOTAL A PAGAR / PAYMENT DUE', tableX + econColWidth * 2 + 8, econY + econHeight - 10, {
    size: 8,
    bold: true,
  })
  drawText(`${formatCurrency(totalDue)} EUR`.trim(), tableX + econColWidth * 2 + 8, econY + econHeight - 24, {
    size: 9,
    bold: true,
  })

  // Logistics block
  const logisticsY = econY - 70
  const leftColX = tableX
  const grossWeight = payload.grossWeight ?? payload.totals?.totalKg ?? totals.totalKg
  const netWeight = payload.netWeight ?? payload.totals?.totalKg ?? totals.totalKg
  const bundles = payload.totals?.totalBundles ?? totals.totalBundles
  const awb = payload.awb ?? '-'
  const flight = payload.flightNumber ?? '-'
  const destination = payload.destination ?? '-'
  drawText(`Peso bruto (kg): ${formatNumber(grossWeight)}   AWB: ${awb}`, leftColX, logisticsY, {
    size: 9,
  })
  drawText(
    `Peso neto (kg): ${formatNumber(netWeight)}   Nº de Vuelo: ${flight}`,
    leftColX,
    logisticsY - 12,
    { size: 9 },
  )
  drawText(`Total Bundles: ${bundles.toLocaleString('es-ES')}   Destino: ${destination}`, leftColX, logisticsY - 24, {
    size: 9,
  })

  // Final consignee
  const consigneeY = logisticsY - 52
  drawText('Destinatario Final / Final Consignee:', leftColX, consigneeY, { size: 9 })
  drawText(payload.finalConsignee ?? payload.receiver.name, leftColX + 200, consigneeY, { size: 9, bold: true })

  // Bank block
  const bankY = margin + 60
  const bankLineHeight = 12
  const bankLabelWidth = 50
  if (payload.bankInfo) {
    drawText('Bank:', leftColX, bankY + bankLineHeight * 3, { size: 9, bold: true })
    drawText(payload.bankInfo.bankName, leftColX + bankLabelWidth, bankY + bankLineHeight * 3, { size: 9 })
    drawText('Account Number IBAN:', leftColX, bankY + bankLineHeight * 2, { size: 9, bold: true })
    drawText(payload.bankInfo.iban, leftColX + 130, bankY + bankLineHeight * 2, { size: 9 })
    drawText('Swift Code:', leftColX, bankY + bankLineHeight, { size: 9, bold: true })
    drawText(payload.bankInfo.swift, leftColX + bankLabelWidth, bankY + bankLineHeight, { size: 9 })
  }
  if (payload.paymentTerms) {
    drawText(`Payment due: ${payload.paymentTerms}`, tableX + blockWidth - 140, bankY - 12, {
      size: 9,
      bold: true,
    })
  }

  const pdfBytes = await pdfDoc.save()
  const sanitizedDate = (payload.invoiceDate || new Date().toISOString().slice(0, 10)).replace(/[/]/g, '-')
  const randomSuffix = Math.random().toString(36).slice(-4)
  const fileName = `factura_${payload.invoiceNumber}_${sanitizedDate}_${randomSuffix}.pdf`
  // Outer border
  page.drawRectangle({
    x: outerMargin,
    y: outerMargin,
    width: width - outerMargin * 2,
    height: height - outerMargin * 2,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  return { pdfBytes, fileName }
}
