export type InvoicePasteRow = {
  product: string
  netWeightKg?: number
  price?: number
  bundles?: number
  total?: number
}

export type InvoicePasteResult = {
  rows: InvoicePasteRow[]
  warnings: string[]
}

const HEADER_MAP: Record<string, keyof InvoicePasteRow> = {
  producto: 'product',
  product: 'product',
  description: 'product',
  desc: 'product',
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

function isLikelyHeader(cells: string[]): boolean {
  return cells.some((cell) => {
    const normalized = cell.toLowerCase().trim()
    return Boolean(HEADER_MAP[normalized])
  })
}

function parseNumber(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/[€$]/g, '').replace(/\s+/g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function mapHeader(cells: string[]): Record<number, keyof InvoicePasteRow> | null {
  const mapping: Record<number, keyof InvoicePasteRow> = {}
  cells.forEach((cell, idx) => {
    const normalized = cell.toLowerCase().trim()
    const key = HEADER_MAP[normalized]
    if (key) {
      mapping[idx] = key
    }
  })
  return Object.keys(mapping).length > 0 ? mapping : null
}

function fallbackMapping(cells: string[]): Record<number, keyof InvoicePasteRow> {
  const mapping: Record<number, keyof InvoicePasteRow> = {}
  let numericSlot = 0
  cells.forEach((cell, idx) => {
    const numeric = parseNumber(cell)
    if (numeric == null && mapping[idx] == null && numericSlot === 0) {
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

export function parseExcelPaste(rawText: string): InvoicePasteResult {
  const delimiter = detectDelimiter(rawText)
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const warnings: string[] = []
  if (lines.length === 0) {
    return { rows: [], warnings: ['No se encontraron filas en el pegado.'] }
  }

  const firstCells = splitLine(lines[0], delimiter)
  const hasHeader = isLikelyHeader(firstCells)
  const headerMapping = hasHeader ? mapHeader(firstCells) : null
  const startIndex = hasHeader ? 1 : 0
  const fallback = hasHeader ? null : fallbackMapping(firstCells)

  const rows: InvoicePasteRow[] = []
  for (let i = startIndex; i < lines.length; i++) {
    const rowText = lines[i]
    if (!rowText) continue
    const cells = splitLine(rowText, delimiter)
    const mapping = headerMapping ?? (i === startIndex ? fallback : fallbackMapping(cells))
    const row: InvoicePasteRow = { product: '' }

    cells.forEach((cell, idx) => {
      const target = mapping?.[idx]
      if (!target) return
      if (target === 'product') {
        row.product = cell
        return
      }
      const numeric = parseNumber(cell)
      if (numeric != null) {
        row[target] = numeric as never
      }
    })

    if (!row.product && cells.join('').length === 0) {
      continue
    }

    if (!row.total && row.netWeightKg != null && row.price != null) {
      row.total = Number((row.netWeightKg * row.price).toFixed(2))
    }

    if (!row.product) {
      warnings.push(`Fila ${i + 1}: producto vacío, por favor edita manualmente.`)
    }
    rows.push(row)
  }

  return { rows, warnings }
}

