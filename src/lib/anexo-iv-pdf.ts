import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface AnexoIVData {
  companyName: string
  companyTaxId: string
  signerName: string
  signerId: string
  signerRole: string
  productName: string
  netWeightKg: number
  grossWeightKg?: number
  form: string
  botanicalName: string
  packageType: string
  packageMark: string
  bundles: number
  transportId: string
  location: string
  dateText: string
  invoiceNumber: string
  items?: {
    productName: string
    netWeightKg?: number
    form?: string
    botanicalName?: string
  }[]
}

export async function generateAnexoIVPdf(data: AnexoIVData): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const margin = 48
  const centerX = width / 2
  const contentWidth = width - margin * 2

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; bold?: boolean },
  ) => {
    page.drawText(text, {
      x,
      y,
      size: options?.size ?? 10,
      font: options?.bold ? boldFont : font,
      color: rgb(0, 0, 0),
    })
  }

  const formatNumber = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return ''
    const rounded = Number(value.toFixed(2))
    const isWhole = Number.isInteger(rounded)
    return rounded.toLocaleString(
      'es-ES',
      isWhole ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    )
  }

  const wrapText = (text: string, maxWidth: number, size: number, isBold = false) => {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let current = ''
    words.forEach((word) => {
      const candidate = current.length === 0 ? word : `${current} ${word}`
      const measure = (isBold ? boldFont : font).widthOfTextAtSize(candidate, size)
      if (measure <= maxWidth || current.length === 0) {
        current = candidate
      } else {
        lines.push(current)
        current = word
      }
    })
    if (current.length > 0) lines.push(current)
    return lines
  }

  const drawSectionTitle = (text: string, y: number) => {
    drawText(text, margin, y, { size: 11, bold: true })
  }

  const drawTable = (
    y: number,
    colTitles: string[],
    colWidths: number[],
    rows: (string | number)[][],
    alignments: ('left' | 'right')[],
  ) => {
    const headerHeight = 16
    const rowHeight = 18
    const tableHeight = headerHeight + rowHeight * rows.length

    // Header row
    let cursorX = margin
    colTitles.forEach((title, idx) => {
      page.drawRectangle({
        x: cursorX,
        y: y - headerHeight,
        width: colWidths[idx],
        height: headerHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
        color: rgb(0.93, 0.93, 0.93),
      })
      drawText(title, cursorX + 4, y - headerHeight + 4, { size: 9, bold: true })
      cursorX += colWidths[idx]
    })

    // Rows
    let currentY = y - headerHeight
    rows.forEach((rowValues) => {
      currentY -= rowHeight
      cursorX = margin
      colWidths.forEach((colW, idx) => {
        page.drawRectangle({
          x: cursorX,
          y: currentY,
          width: colW,
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        })
        const value = rowValues[idx]
        const text = typeof value === 'number' ? value.toLocaleString('es-ES') : value ?? ''
        const textWidth = font.widthOfTextAtSize(text, 10)
        const textX =
          alignments[idx] === 'right'
            ? cursorX + colW - textWidth - 6
            : cursorX + 6
        drawText(text, textX, currentY + 5, { size: 10 })
        cursorX += colW
      })
    })

    return y - tableHeight - 12
  }

  const lineHeight = 14
  let cursorY = height - margin
  const normalizeProductName = (raw: string) => {
    const lower = (raw || '').toLowerCase()
    if (lower.includes('albah') || lower.includes('basil')) return 'ALBAHACA'
    return raw
  }

  // Encabezado centrado y referencia
  drawText('ANEXO IV', centerX - boldFont.widthOfTextAtSize('ANEXO IV', 13) / 2, cursorY, { size: 13, bold: true })
  cursorY -= lineHeight
  const subTitle = 'Declaración del exportador'
  drawText(subTitle, centerX - font.widthOfTextAtSize(subTitle, 12) / 2, cursorY, { size: 12 })
  const refLabel = `Nº DE REFERENCIA: ${data.invoiceNumber}`
  drawText(refLabel, width - margin - font.widthOfTextAtSize(refLabel, 10), height - margin, { size: 10, bold: true })
  cursorY -= lineHeight * 2

  drawText('Datos de la empresa declarante', margin, cursorY, { size: 11, bold: true })
  cursorY -= lineHeight
  drawText(`Nombre / Razón social: ${data.companyName}`, margin, cursorY)
  cursorY -= lineHeight
  drawText(`NIF: ${data.companyTaxId}`, margin, cursorY)
  cursorY -= lineHeight * 1.5

  drawText('Datos de la persona firmante', margin, cursorY, { size: 11, bold: true })
  cursorY -= lineHeight
  drawText(`Nombre y apellidos: ${data.signerName}`, margin, cursorY)
  cursorY -= lineHeight
  drawText(`DNI: ${data.signerId}`, margin, cursorY)
  cursorY -= lineHeight
  drawText(`Cargo: ${data.signerRole}`, margin, cursorY)
  cursorY -= lineHeight * 1.5

  drawSectionTitle('Datos de la partida exportada', cursorY)
  cursorY -= lineHeight
  const partidaRows = (() => {
    if (data.items && data.items.length > 0) {
      const grouped = new Map<
        string,
        { netWeightKg: number; form?: string; botanicalName?: string }
      >()
      data.items.forEach((item) => {
        const name = normalizeProductName(item.productName)
        const entry = grouped.get(name) ?? { netWeightKg: 0, form: item.form, botanicalName: item.botanicalName }
        entry.netWeightKg += item.netWeightKg ?? 0
        if (!entry.form && item.form) entry.form = item.form
        if (!entry.botanicalName && item.botanicalName) entry.botanicalName = item.botanicalName
        grouped.set(name, entry)
      })
      return Array.from(grouped.entries()).map(([name, info]) => [
        name,
        info.netWeightKg,
        info.form ?? data.form,
        info.botanicalName ?? data.botanicalName,
      ])
    }
    return [
      [normalizeProductName(data.productName), data.netWeightKg, data.form, data.botanicalName],
    ]
  })()

  cursorY = drawTable(
    cursorY,
    ['Denominación producto', 'Peso neto (kg)', 'Forma', 'Nombre botánico'],
    [170, 90, 110, 150],
    partidaRows,
    ['left', 'right', 'left', 'left'],
  )

  drawSectionTitle('Datos de bultos y transporte', cursorY)
  cursorY -= lineHeight
  cursorY = drawTable(
    cursorY,
    ['Tipo de bulto', 'Marcas bulto', 'Número de bultos', 'Identificación del transporte'],
    [130, 130, 110, 150],
    [[data.packageType, data.packageMark, data.bundles, data.transportId]],
    ['left', 'left', 'right', 'left'],
  )

  const grossWeightKg = data.grossWeightKg ?? data.netWeightKg
  drawText(`Peso bruto (kg): ${formatNumber(grossWeightKg)}`, margin, cursorY)
  cursorY -= lineHeight
  drawText(`Peso neto (kg): ${formatNumber(data.netWeightKg)}`, margin, cursorY)
  cursorY -= lineHeight
  drawText(`Número de bultos: ${data.bundles.toLocaleString('es-ES')}`, margin, cursorY)
  cursorY -= lineHeight * 1.5

  drawText('Fecha y lugar', margin, cursorY, { size: 11, bold: true })
  cursorY -= lineHeight
  drawText(`Lugar: ${data.location}`, margin, cursorY)
  cursorY -= lineHeight
  drawText('FECHA', margin, cursorY, { size: 10, bold: true })
  cursorY -= lineHeight
  drawText(data.dateText, margin, cursorY)
  cursorY -= lineHeight * 1.5

  drawText('DECLARA BAJO SU RESPONSABILIDAD:', margin, cursorY, { size: 11, bold: true })
  cursorY -= lineHeight
  const puntos = [
    '1. Conocer los requisitos fitosanitarios exigidos por ...ESPAÑA (MADRID).',
    '2. Que, de acuerdo con los documentos e información disponibles, los vegetales o productos vegetales u otros objetos a exportar cumplen los requisitos indicados en el punto 1.',
    '3. Que son ciertos los datos consignados en esta declaración, reuniendo por ello la partida los requisitos exigidos y comprometiéndose a probar documentalmente, cuando le sea requerido, todos los datos que figuran en la misma.',
    '4. Que asume la responsabilidad de los perjuicios derivados en caso de que la autoridad del país de destino imponga restricciones, o que los requisitos fitosanitarios conocidos antes de la exportación no sean los exigidos; para el ingreso de la mercancía en su territorio.',
    '5. Que ..SI.. dispone de la documentación que así lo acredita, y que la pondrá a disposición de la Administración cuando le sea requerida',
  ]
  const legalWidth = width - margin * 2 - 16
  puntos.forEach((texto, idx) => {
    const parts = texto.split('. ')
    const num = parts.shift() ?? `${idx + 1}.`
    const rest = parts.join('. ')
    const numWidth = boldFont.widthOfTextAtSize(num, 10)
    drawText(num, margin, cursorY, { size: 10, bold: true })
    const lines = wrapText(rest, legalWidth - numWidth - 8, 10)
    let innerY = cursorY
    lines.forEach((line, lineIdx) => {
      const lineX = margin + numWidth + 6
      drawText(line, lineX, innerY, { size: 10 })
      innerY -= lineHeight
    })
    cursorY = innerY
  })

  cursorY -= lineHeight * 2
  drawText(`En ${data.location}, a ${data.dateText}`, margin, cursorY, { size: 10 })
  cursorY -= lineHeight * 2
  const signatureLine = '__________________________'
  drawText(`Fdo.: ${signatureLine}`, margin, cursorY, { size: 10 })
  cursorY -= lineHeight
  drawText(data.signerName, margin, cursorY, { size: 10, bold: true })

  cursorY -= lineHeight * 1.5
  drawText('Documentación que se adjunta a la presente declaración.', margin, cursorY, { size: 11, bold: true })
  cursorY -= lineHeight
  drawText('Tipo de documento       No referencia.', margin, cursorY, { size: 10 })
  cursorY -= lineHeight
  drawText(`FACTURA ${data.invoiceNumber}`, margin + 12, cursorY, { size: 10 })
  cursorY -= lineHeight
  drawText('DECLARACIÓN ADICIONAL', margin + 12, cursorY, { size: 10 })

  cursorY -= lineHeight * 1.5
  drawText('1', margin, cursorY, { size: 10, bold: true })
  const note1 =
    'No de referencia único, asignado por el exportador a cada una de sus declaraciones, según su sistema de registro. Si la declaración consta de varias páginas, deberá figurar en cada una de ellas.'
  const note1Lines = wrapText(note1, contentWidth - 20, 10)
  let noteCursor = cursorY
  note1Lines.forEach((line) => {
    drawText(line, margin + 14, noteCursor, { size: 10 })
    noteCursor -= lineHeight
  })
  cursorY = noteCursor - 4

  drawText('2', margin, cursorY, { size: 10, bold: true })
  const note2 =
    'Deberán indicarse los mismos datos que los referidos en la solicitud de inspección para la obtención del Certificado Fitosanitario de Exportación.'
  const note2Lines = wrapText(note2, contentWidth - 20, 10)
  noteCursor = cursorY
  note2Lines.forEach((line) => {
    drawText(line, margin + 14, noteCursor, { size: 10 })
    noteCursor -= lineHeight
  })

  const pdfBytes = await pdfDoc.save()
  const randomSuffix = Math.random().toString(36).slice(-4)
  const fileName = `anexo_iv_${data.invoiceNumber.replace(/\s+/g, '_')}_${randomSuffix}.pdf`
  return { pdfBytes, fileName }
}
