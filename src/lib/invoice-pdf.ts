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

export async function generateInvoicePdf(payload: InvoicePayload): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const margin = 32
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
  drawText(payload.emitter.name, margin, cursorY, { size: FONT_SIZE.heading, bold: true })
  cursorY -= 14
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
  const emitterMaxWidth = receiverX - margin - 12
  emitterLines.forEach((line) => {
    const wrapped = wrapText(line ?? '', emitterMaxWidth, font, FONT_SIZE.body)
    wrapped.forEach((wrappedLine) => {
      drawText(wrappedLine, margin, cursorY, { size: FONT_SIZE.body })
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
  const invoiceBoxHeight = 42
  const invoiceBoxWidth = 240
  const invoiceTop = Math.min(emitterBottomY, receiverTop - receiverBoxHeight - 8)
  const invoiceBoxY = invoiceTop - invoiceBoxHeight
  page.drawRectangle({
    x: margin,
    y: invoiceBoxY,
    width: invoiceBoxWidth,
    height: invoiceBoxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  drawText('FACTURA / INVOICE', margin + 8, invoiceTop - 12, { size: FONT_SIZE.body, bold: true })
  drawLabelValue('Número / Number', payload.invoiceNumber, margin + 8, invoiceTop - 22, 110)
  drawLabelValue('Fecha / Date', formatDate(payload.invoiceDate), margin + 140, invoiceTop - 22, 90)
  cursorY = invoiceBoxY - 16

  // Destination / Incoterm
  drawLabelValue('DESTINO / DESTINATION', payload.destination || '—', margin, cursorY, 220)
  drawLabelValue('INCOTERM', payload.incoterm || '—', margin + 240, cursorY, 140)
  cursorY -= 44

  // Table header
  const colWidths = [200, 80, 80, 70, 90]
  const colTitles = ['PRODUCTO / PRODUCT', 'Peso Neto (Kg)', 'Precio/Kg (€)', 'Bultos', 'Importe']
  const tableX = margin
  const tableY = cursorY
  const rowHeight = 20

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
  colTitles.forEach((title, idx) => {
    drawText(title, cursorX, tableY - 14, { size: FONT_SIZE.table, bold: true })
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

  // Totals row
  const totalsY = margin + 220
  page.drawRectangle({
    x: tableX,
    y: totalsY + 28,
    width: colWidths.reduce((a, b) => a + b, 0),
    height: 36,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  drawText('SUMA IMPORTES / BASE IMPONIBLE', tableX + 8, totalsY + 48, { size: FONT_SIZE.small, bold: true })
  drawText(formatCurrency(totals.totalAmount), tableX + 8, totalsY + 32, { size: FONT_SIZE.body, bold: true })
  drawText(`IGIC: ${(igicRate * 100).toFixed(0)}%`, tableX + 220, totalsY + 48, { size: FONT_SIZE.small, bold: true })
  drawText(formatCurrency(igicAmount), tableX + 220, totalsY + 32, { size: FONT_SIZE.body })
  drawText('TOTAL A PAGAR / PAYMENT DUE', tableX + 360, totalsY + 48, { size: FONT_SIZE.small, bold: true })
  drawText(formatCurrency(totalDue), tableX + 360, totalsY + 32, { size: FONT_SIZE.body, bold: true })

  // Summary line
  const summaryY = totalsY + 12
  const summary = [
    `Total Kg: ${(payload.totals?.totalKg ?? totals.totalKg).toLocaleString('es-ES')}`,
    `Total Bultos: ${(payload.totals?.totalBundles ?? totals.totalBundles).toLocaleString('es-ES')}`,
  ].join('    ')
  drawText(summary, tableX, summaryY, { size: FONT_SIZE.body })

  // Certification
  if (payload.ggnOrCoc) {
    drawText(`GGN / CoC: ${payload.ggnOrCoc}`, tableX, summaryY - 16, { size: FONT_SIZE.body })
  }

  // Footer bank
  const bankY = margin + 60
  if (payload.bankInfo) {
    drawText('Bank:', tableX, bankY + 32, { size: FONT_SIZE.body, bold: true })
    drawText(payload.bankInfo.bankName, tableX + 40, bankY + 32, { size: FONT_SIZE.body })
    drawText(`IBAN: ${payload.bankInfo.iban}`, tableX, bankY + 18, { size: FONT_SIZE.body })
    drawText(`SWIFT: ${payload.bankInfo.swift}`, tableX, bankY + 4, { size: FONT_SIZE.body })
  }
  if (payload.paymentTerms) {
    drawText(`Payment due: ${payload.paymentTerms}`, tableX, bankY - 10, {
      size: FONT_SIZE.body,
      bold: true,
    })
  }

  const pdfBytes = await pdfDoc.save()
  const sanitizedDate = (payload.invoiceDate || new Date().toISOString().slice(0, 10)).replace(/[/]/g, '-')
  const randomSuffix = Math.random().toString(36).slice(-4)
  const fileName = `factura_${payload.invoiceNumber}_${sanitizedDate}_${randomSuffix}.pdf`
  return { pdfBytes, fileName }
}
