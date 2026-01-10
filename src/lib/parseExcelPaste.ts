export type InvoicePasteRow = {
  product: string
  invoiceNumber?: string
  awb?: string
  netWeightKg?: number
  price?: number
  bundles?: number
  total?: number
}

export type InvoicePasteHeader = {
  invoiceNumber?: string
  awb?: string
}

export type InvoicePasteResult = {
  header: InvoicePasteHeader
  rows: InvoicePasteRow[]
  warnings: string[]
}

const ROW_HEADER_MAP: Record<string, keyof InvoicePasteRow> = {
  producto: 'product',
  product: 'product',
  description: 'product',
  desc: 'product',
  factura: 'invoiceNumber',
  invoice: 'invoiceNumber',
  'invoice number': 'invoiceNumber',
  awb: 'awb',
  'air waybill': 'awb',
  'peso neto': 'netWeightKg',
  peso: 'netWeightKg',
  kg: 'netWeightKg',
  neto: 'netWeightKg',
  net: 'netWeightKg',
  'kg net': 'netWeightKg',
  'net weight': 'netWeightKg',
  price: 'price',
  precio: 'price',
  'precio/kg': 'price',
  'price/kg': 'price',
  'price per kg': 'price',
  bultos: 'bundles',
  bundles: 'bundles',
  cajas: 'bundles',
  boxes: 'bundles',
  importe: 'total',
  total: 'total',
  amount: 'total',
}

const HEADER_FIELD_MAP: Record<string, keyof InvoicePasteHeader> = {
  factura: 'invoiceNumber',
  invoice: 'invoiceNumber',
  'invoice number': 'invoiceNumber',
  awb: 'awb',
  'air waybill': 'awb',
}

type HeaderIndexes = {
  invoiceNumber: number[]
  awb: number[]
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const sample = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
  const tab = (sample.match(/\t/g) ?? []).length
  const comma = (sample.match(/,/g) ?? []).length
  const semi = (sample.match(/;/g) ?? []).length
  if (tab >= comma && tab >= semi) return '\t'
  if (semi > comma) return ';'
  return ','
}

function splitLine(line: string, delimiter: ',' | ';' | '\t'): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      const next = line[i + 1]
      if (next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ''
      continue
    }
    current += char
  }
  result.push(current)
  return result.map((value) => value.trim())
}

function normalizeHeader(cell: string): string {
  return cell.toLowerCase().trim().replace(/\s+/g, ' ')
}

function isLikelyHeader(cells: string[]): boolean {
  return cells.some((cell) => {
    const normalized = normalizeHeader(cell)
    return Boolean(ROW_HEADER_MAP[normalized] || HEADER_FIELD_MAP[normalized])
  })
}

function parseNumber(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/[€$]/g, '').replace(/\s+/g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function mapHeader(cells: string[]): { rowMapping: Record<number, keyof InvoicePasteRow>; headerIndexes: HeaderIndexes } | null {
  const rowMapping: Record<number, keyof InvoicePasteRow> = {}
  const headerIndexes: HeaderIndexes = { invoiceNumber: [], awb: [] }
  cells.forEach((cell, idx) => {
    const normalized = normalizeHeader(cell)
    const rowKey = ROW_HEADER_MAP[normalized]
    if (rowKey) {
      rowMapping[idx] = rowKey
    }
    const headerKey = HEADER_FIELD_MAP[normalized]
    if (headerKey) {
      headerIndexes[headerKey].push(idx)
    }
  })
  const hasRowMapping = Object.keys(rowMapping).length > 0
  const hasHeaderIndexes = headerIndexes.invoiceNumber.length > 0 || headerIndexes.awb.length > 0
  return hasRowMapping || hasHeaderIndexes ? { rowMapping, headerIndexes } : null
}

function fallbackMapping(cells: string[]): Record<number, keyof InvoicePasteRow> {
  const mapping: Record<number, keyof InvoicePasteRow> = {}
  let numericSlot = 0
  cells.forEach((cell, idx) => {
    const numeric = parseNumber(cell)
    if (numeric == null && mapping[idx] == null && numericSlot === 0 && cell.length > 0) {
      mapping[idx] = 'product'
      return
    }
    if (numeric != null) {
      if (numericSlot === 0) {
        mapping[idx] = 'netWeightKg'
      } else if (numericSlot === 1) {
        mapping[idx] = 'price'
      } else if (numericSlot === 2) {
        mapping[idx] = 'bundles'
      } else if (numericSlot === 3) {
        mapping[idx] = 'total'
      }
      numericSlot++
    }
  })
  return mapping
}

function firstNonEmptyValue(cells: string[], indexes: number[]): string | undefined {
  for (const idx of indexes) {
    const value = cells[idx]
    if (value != null && value.trim().length > 0) {
      return value
    }
  }
  return undefined
}

export function parseExcelPaste(rawText: string): InvoicePasteResult {
  const delimiter = detectDelimiter(rawText)
  const lines = rawText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  const warnings: string[] = []
  if (lines.length === 0) {
    return { header: {}, rows: [], warnings: ['No se encontraron filas en el pegado.'] }
  }

  const firstCells = splitLine(lines[0], delimiter)
  const hasHeader = isLikelyHeader(firstCells)
  const headerInfo = hasHeader ? mapHeader(firstCells) : null
  const headerMapping =
    headerInfo?.rowMapping && Object.keys(headerInfo.rowMapping).length > 0 ? headerInfo.rowMapping : null
  const headerIndexes = headerInfo?.headerIndexes ?? { invoiceNumber: [], awb: [] }
  const startIndex = hasHeader ? 1 : 0
  const fallback = hasHeader ? null : fallbackMapping(firstCells)

  const rows: InvoicePasteRow[] = []
  const header: InvoicePasteHeader = {}
  for (let i = startIndex; i < lines.length; i++) {
    const rowText = lines[i]
    if (!rowText) continue
    const cells = splitLine(rowText, delimiter)
    if (cells.every((cell) => cell.trim().length === 0)) {
      continue
    }
    if (!header.invoiceNumber) {
      const invoiceCandidate = firstNonEmptyValue(cells, headerIndexes.invoiceNumber)
      if (invoiceCandidate) {
        header.invoiceNumber = invoiceCandidate
      }
    }
    if (!header.awb) {
      const awbCandidate = firstNonEmptyValue(cells, headerIndexes.awb)
      if (awbCandidate) {
        header.awb = awbCandidate
      }
    }
    const mapping =
      headerMapping ?? (i === startIndex ? (fallback ?? fallbackMapping(cells)) : fallbackMapping(cells))
    const row: InvoicePasteRow = { product: '' }

    cells.forEach((cell, idx) => {
      const target = mapping?.[idx]
      if (!target) return
      if (target === 'product') {
        row.product = cell
        return
      }
      if (target === 'invoiceNumber' || target === 'awb') {
        row[target] = cell
        return
      }
      const numeric = parseNumber(cell)
      if (numeric != null) {
        row[target] = numeric as never
      }
    })

    if (!row.total && row.netWeightKg != null && row.price != null) {
      row.total = Number((row.netWeightKg * row.price).toFixed(2))
    }

    if (!row.product) {
      warnings.push(`Fila ${i + 1}: producto vacío, por favor edita manualmente.`)
    }
    rows.push(row)
  }

  return { header, rows, warnings }
}
