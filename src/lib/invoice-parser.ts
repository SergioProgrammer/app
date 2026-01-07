export interface ParsedInvoiceRow {
  product: string
  netWeightKg: number
  pricePerKg: number
  bundles?: number
  total?: number
}

export interface InvoiceParseResult {
  items: ParsedInvoiceRow[]
  errors: string[]
  totals: {
    totalKg: number
    totalBundles: number
    totalAmount: number
  }
}

const HEADER_MAP: Record<string, keyof ParsedInvoiceRow> = {
  producto: 'product',
  product: 'product',
  description: 'product',
  desc: 'product',
  'peso neto': 'netWeightKg',
  kg: 'netWeightKg',
  'kg net': 'netWeightKg',
  'net weight': 'netWeightKg',
  peso: 'netWeightKg',
  'precio/kg': 'pricePerKg',
  'precio kg': 'pricePerKg',
  precio: 'pricePerKg',
  price: 'pricePerKg',
  'price/kg': 'pricePerKg',
  'price kg': 'pricePerKg',
  'price per kg': 'pricePerKg',
  bultos: 'bundles',
  bundles: 'bundles',
  cajas: 'bundles',
  boxes: 'bundles',
  importe: 'total',
  total: 'total',
  'total due': 'total',
}

const DEFAULT_COLUMNS_ORDER: Array<keyof ParsedInvoiceRow> = [
  'product',
  'netWeightKg',
  'pricePerKg',
  'bundles',
  'total',
]

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const probe = lines[0] ?? ''
  const tabCount = (probe.match(/\t/g) ?? []).length
  const commaCount = (probe.match(/,/g) ?? []).length
  const semiCount = (probe.match(/;/g) ?? []).length
  if (tabCount >= commaCount && tabCount >= semiCount) return '\t'
  if (semiCount > commaCount) return ';'
  return ','
}

function splitLine(line: string, delimiter: ',' | ';' | '\t'): string[] {
  // Minimal CSV/TSV split that respects simple quoted fields.
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

function normalizeNumber(value?: string | number | null): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value
    .replace(/[€$]/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function mapHeaderToIndexes(header: string[]): Record<number, keyof ParsedInvoiceRow> | null {
  const mapping: Record<number, keyof ParsedInvoiceRow> = {}
  header.forEach((cell, index) => {
    const key = cell.toLowerCase().trim()
    const normalized = key.replace(/\s+/g, ' ')
    const match = HEADER_MAP[normalized]
    if (match) {
      mapping[index] = match
    }
  })
  return Object.keys(mapping).length > 0 ? mapping : null
}

export function parseInvoiceTable(rawText: string): InvoiceParseResult {
  const errors: string[] = []
  const items: ParsedInvoiceRow[] = []

  const delimiter = detectDelimiter(rawText)
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return {
      items: [],
      errors: ['No se encontraron filas en el pegado.'],
      totals: { totalAmount: 0, totalBundles: 0, totalKg: 0 },
    }
  }

  const headerCandidate = splitLine(lines[0] ?? '', delimiter)
  const headerMapping = mapHeaderToIndexes(headerCandidate)
  const startIndex = headerMapping ? 1 : 0
  const columnsOrder = headerMapping ?? DEFAULT_COLUMNS_ORDER.reduce((acc, key, index) => {
    acc[index] = key
    return acc
  }, {} as Record<number, keyof ParsedInvoiceRow>)

  for (let i = startIndex; i < lines.length; i++) {
    const rowRaw = lines[i]
    if (!rowRaw) continue
    const cells = splitLine(rowRaw, delimiter)
    const row: Partial<ParsedInvoiceRow> = {}
    cells.forEach((cell, idx) => {
      const target = columnsOrder[idx]
      if (!target) return
      if (target === 'product') {
        row.product = cell || `Producto ${i}`
        return
      }
      const numeric = normalizeNumber(cell)
      if (numeric != null) {
        row[target] = numeric as never
      }
    })

    if (!row.product) {
      errors.push(`Fila ${i + 1}: sin producto, se omitió.`)
      continue
    }

    const netWeightKg = row.netWeightKg ?? 0
    const pricePerKg = row.pricePerKg ?? 0
    const bundles = row.bundles
    const total =
      row.total ??
      (netWeightKg && pricePerKg ? Number((netWeightKg * pricePerKg).toFixed(2)) : undefined)

    items.push({
      product: row.product,
      netWeightKg,
      pricePerKg,
      bundles,
      total,
    })
  }

  const totals = items.reduce(
    (acc, item) => {
      acc.totalKg += item.netWeightKg || 0
      acc.totalBundles += item.bundles || 0
      acc.totalAmount += item.total || 0
      return acc
    },
    { totalKg: 0, totalBundles: 0, totalAmount: 0 },
  )

  return { items, errors, totals }
}

