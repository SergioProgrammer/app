'use client'

import { ChevronDown, ChevronRight, ClipboardPaste } from 'lucide-react'
import { useCallback, useState } from 'react'
import { parseExcelPaste } from '@/lib/parseExcelPaste'
import type { SpreadsheetRowClient, SpreadsheetColumnKey } from '../types'
import { SPREADSHEET_COLUMNS, getWeekString } from '../types'

interface PasteFromExcelProps {
  onPaste: (rows: Omit<SpreadsheetRowClient, 'id' | 'position'>[]) => void
}

const COLUMN_ALIASES: Record<string, SpreadsheetColumnKey> = {
  semana: 'week',
  week: 'week',
  'fecha factura': 'invoiceDate',
  'invoice date': 'invoiceDate',
  'fecha corte': 'date',
  fecha: 'date',
  date: 'date',
  'cliente final': 'finalClient',
  cliente: 'finalClient',
  client: 'finalClient',
  kg: 'kg',
  peso: 'kg',
  weight: 'kg',
  producto: 'product',
  product: 'product',
  'tipo caja': 'boxType',
  'box type': 'boxType',
  caja: 'boxType',
  bultos: 'bundles',
  bundles: 'bundles',
  precio: 'price',
  price: 'price',
  'n pedido': 'orderNumber',
  'no pedido': 'orderNumber',
  'num pedido': 'orderNumber',
  pedido: 'orderNumber',
  'order number': 'orderNumber',
  order: 'orderNumber',
  awb: 'awb',
  albaran: 'deliveryNote',
  'delivery note': 'deliveryNote',
  'n factura': 'invoiceNumber',
  'no factura': 'invoiceNumber',
  'num factura': 'invoiceNumber',
  factura: 'invoiceNumber',
  'invoice number': 'invoiceNumber',
  invoice: 'invoiceNumber',
  linea: 'line',
  line: 'line',
  busqueda: 'search',
  busq: 'search',
  search: 'search',
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
}

function matchColumnHeader(header: string): SpreadsheetColumnKey | null {
  const normalized = normalizeLabel(header)

  // Try exact label match first
  for (const col of SPREADSHEET_COLUMNS) {
    if (normalizeLabel(col.label) === normalized) return col.key
  }

  // Try aliases
  if (normalized in COLUMN_ALIASES) return COLUMN_ALIASES[normalized]

  return null
}

function detectHeaderRow(firstLine: string): boolean {
  const cells = firstLine.split('\t').map((c) => c.trim())
  if (cells.length < 2) return false
  const matched = cells.filter((c) => matchColumnHeader(c) !== null).length
  return matched >= 2
}

const NUMBER_COLUMNS = new Set<SpreadsheetColumnKey>(
  SPREADSHEET_COLUMNS.filter((c) => c.inputType === 'number').map((c) => c.key),
)

const DATE_COLUMNS = new Set<SpreadsheetColumnKey>(
  SPREADSHEET_COLUMNS.filter((c) => c.inputType === 'date').map((c) => c.key),
)

/** Converts dd/mm/yyyy or d/m/yyyy to yyyy-mm-dd. Returns empty string if invalid. */
function parseDateValue(val: string): string {
  // Already in yyyy-mm-dd format
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val

  const match = val.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (!match) return ''
  const [, dayStr, monthStr, yearStr] = match
  const day = parseInt(dayStr, 10)
  const month = parseInt(monthStr, 10)
  const year = parseInt(yearStr, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function emptyRowData(): Omit<SpreadsheetRowClient, 'id' | 'position'> {
  return {
    week: '',
    invoiceDate: '',
    date: '',
    finalClient: '',
    kg: '',
    product: '',
    boxType: '',
    bundles: '',
    price: '',
    orderNumber: '',
    awb: '',
    deliveryNote: '',
    invoiceNumber: '',
    line: '',
    search: '',
  }
}

function parseSpreadsheetPaste(text: string): {
  rows: Omit<SpreadsheetRowClient, 'id' | 'position'>[]
  warnings: string[]
} {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return { rows: [], warnings: ['Se necesitan al menos 2 líneas (cabecera + datos).'] }

  const headerCells = lines[0].split('\t').map((c) => c.trim())
  const columnMap: (SpreadsheetColumnKey | null)[] = headerCells.map((h) => matchColumnHeader(h))
  const warnings: string[] = []

  const unrecognized = headerCells.filter((_, i) => columnMap[i] === null)
  if (unrecognized.length > 0) {
    warnings.push(`Columnas no reconocidas (se ignoran): ${unrecognized.join(', ')}`)
  }

  const rows: Omit<SpreadsheetRowClient, 'id' | 'position'>[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t')
    const row = emptyRowData()
    let hasData = false

    for (let j = 0; j < columnMap.length; j++) {
      const key = columnMap[j]
      if (!key) continue
      const val = (cells[j] ?? '').trim()
      if (!val) continue

      if (NUMBER_COLUMNS.has(key)) {
        const num = parseFloat(val.replace(',', '.'))
        if (isNaN(num)) {
          warnings.push(`Fila ${i}: "${val}" no es un número válido para ${key}, se deja vacío.`)
          continue
        }
        row[key] = String(num)
      } else if (DATE_COLUMNS.has(key)) {
        const parsed = parseDateValue(val)
        if (!parsed) {
          warnings.push(`Fila ${i}: "${val}" no es una fecha válida para ${key}, se deja vacío.`)
          continue
        }
        row[key] = parsed
      } else {
        row[key] = val
      }
      hasData = true
    }

    // Recalcular semana a partir de invoiceDate
    if (row.invoiceDate) {
      row.week = getWeekString(row.invoiceDate)
    }

    if (hasData) rows.push(row)
  }

  return { rows, warnings }
}

// Mapeo de campos parseados a columnas de la tabla (fallback for non-header paste)
function mapParsedRow(
  parsed: Record<string, unknown>,
): Omit<SpreadsheetRowClient, 'id' | 'position'> {
  return {
    week: '',
    invoiceDate: '',
    date: '',
    finalClient: '',
    kg: parsed.netWeightKg != null ? String(parsed.netWeightKg) : '',
    product: (parsed.product as string) ?? '',
    boxType: '',
    bundles: parsed.bundles != null ? String(parsed.bundles) : '',
    price: parsed.price != null ? String(parsed.price) : '',
    orderNumber: '',
    awb: (parsed.awb as string) ?? '',
    deliveryNote: '',
    invoiceNumber: (parsed.invoiceNumber as string) ?? '',
    line: '',
    search: '',
  }
}

const ALL_RECOGNIZED_LABELS = [
  ...SPREADSHEET_COLUMNS.map((c) => c.label),
  'Peso', 'Weight', 'Product', 'Client', 'Bundles', 'Price',
  'Invoice', 'Order', 'Line', 'Search', 'Pedido', 'Factura',
]

export function PasteFromExcel({ onPaste }: PasteFromExcelProps) {
  const [open, setOpen] = useState(false)
  const [rawText, setRawText] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  const handleProcess = useCallback(() => {
    setWarnings([])
    const lines = rawText.split('\n').filter((l) => l.trim())
    if (lines.length === 0) {
      setWarnings(['No se encontraron filas.'])
      return
    }

    // Try smart header-based matching first
    if (detectHeaderRow(lines[0])) {
      const result = parseSpreadsheetPaste(rawText)
      if (result.rows.length === 0) {
        setWarnings(result.warnings.length > 0 ? result.warnings : ['No se encontraron filas con datos.'])
        return
      }
      setWarnings(result.warnings)
      onPaste(result.rows)
      setRawText('')
      return
    }

    // Fallback to existing parser
    const result = parseExcelPaste(rawText)
    if (result.rows.length === 0) {
      setWarnings(result.warnings.length > 0 ? result.warnings : ['No se encontraron filas.'])
      return
    }
    setWarnings(result.warnings)
    onPaste(result.rows.map((row) => mapParsedRow(row as unknown as Record<string, unknown>)))
    setRawText('')
  }, [rawText, onPaste])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Pegar desde Excel</h2>
          <span className="text-xs text-gray-400">
            {open ? '(Click para plegar)' : '(Click para desplegar)'}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
          <p className="text-xs text-gray-500">
            Copia filas desde Excel y pégalas aquí. Si la primera fila contiene cabeceras,
            las columnas se detectan automáticamente. Nombres reconocidos:{' '}
            {ALL_RECOGNIZED_LABELS.join(', ')}.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Pega aquí los datos copiados desde Excel..."
            rows={5}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
          />
          {warnings.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-amber-700 space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <button
            onClick={handleProcess}
            disabled={!rawText.trim()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ClipboardPaste className="h-4 w-4" />
            Procesar pegado
          </button>
        </div>
      )}
    </div>
  )
}
