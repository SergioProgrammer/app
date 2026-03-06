export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'justSaved'

export interface SpreadsheetRowClient {
  id: string
  position: number
  week: string
  invoiceDate: string
  date: string
  finalClient: string
  kg: string
  product: string
  boxType: string
  abono: string
  bundles: string
  price: string
  awb: string
  flightNumber: string
  destination: string
  incoterm: string
  deliveryNote: string
  invoiceNumber: string
  search: string
}

export interface HeaderDataClient {
  clientName: string
  clientTaxId: string
  clientAddress: string
  emitterName: string
  emitterTaxId: string
  emitterAddress: string
  paymentTerms: string
  bankName: string
  bankIban: string
  bankSwift: string
  productForm: string
  botanicalName: string
}

export type DayOfWeek = 'lunes' | 'martes' | 'sabado'

export interface SpreadsheetListItem {
  id: string
  name: string
  rowCount: number
  dayOfWeek: DayOfWeek | null
  createdAt: string
  updatedAt: string
}

export interface SpreadsheetDetail {
  id: string
  name: string
  headerData: HeaderDataClient
  rows: SpreadsheetRowClient[]
  createdAt: string
  updatedAt: string
}

export type ColumnInputType = 'text' | 'number' | 'date'

export const SPREADSHEET_COLUMNS = [
  { key: 'week', label: 'Semana', width: 100, inputType: 'text' as ColumnInputType },
  { key: 'invoiceDate', label: 'Fecha factura', width: 170, inputType: 'date' as ColumnInputType },
  { key: 'date', label: 'Fecha corte', width: 170, inputType: 'date' as ColumnInputType },
  { key: 'finalClient', label: 'Cliente final', width: 480, inputType: 'text' as ColumnInputType },
  { key: 'kg', label: 'Kg por bulto', width: 140, inputType: 'number' as ColumnInputType },
  { key: 'product', label: 'Producto', width: 630, inputType: 'text' as ColumnInputType },
  { key: 'boxType', label: 'Tipo caja', width: 160, inputType: 'text' as ColumnInputType },
  { key: 'bundles', label: 'Bultos', width: 100, inputType: 'number' as ColumnInputType },
  { key: 'abono', label: 'Abono', width: 60, inputType: 'number' as ColumnInputType },
  { key: 'price', label: 'Precio', width: 60, inputType: 'number' as ColumnInputType },
  { key: 'awb', label: 'AWB', width: 390, inputType: 'text' as ColumnInputType },
  { key: 'flightNumber', label: 'Nº vuelo', width: 160, inputType: 'text' as ColumnInputType },
  { key: 'destination', label: 'Destino', width: 220, inputType: 'text' as ColumnInputType },
  { key: 'incoterm', label: 'Incoterm', width: 70, inputType: 'text' as ColumnInputType },
  { key: 'deliveryNote', label: 'Albarán', width: 85, inputType: 'text' as ColumnInputType },
  { key: 'invoiceNumber', label: 'Nº factura', width: 180, inputType: 'text' as ColumnInputType },
  { key: 'search', label: 'Búsqueda', width: 180, inputType: 'text' as ColumnInputType },
] as const

export type SpreadsheetColumnKey = (typeof SPREADSHEET_COLUMNS)[number]['key']

export const REQUIRED_ROW_FIELDS: SpreadsheetColumnKey[] = ['product', 'kg', 'price', 'abono']

export const DEFAULT_HEADER: HeaderDataClient = {
  clientName: 'ARICO FRUITS SL',
  clientTaxId: 'B24895971',
  clientAddress: 'MERCAMADRID NAVE POLIVALENCIA 21/23 · 28053 · MADRID',
  emitterName: 'YEOWARD DEL CAMPO SDAD COOP LTDA DE VECINDARIO LAS PALMAS',
  emitterTaxId: 'F35077700',
  emitterAddress: 'AVDA CANARIAS NUM 249 · 35110 SANTA LUCIA DE TIRAJANA · LAS PALMAS DE GRAN CANARIA',
  paymentTerms: '30 days',
  bankName: 'CAJAMAR CAJA RURAL, SOCIEDAD COOPERATIVA DE CRÉDITO.',
  bankIban: 'ES59 3058 6105 1828 1001 2174',
  bankSwift: 'CCRIES2AXXX',
  productForm: 'HOJAS FRESCAS',
  botanicalName: 'Ocimum basilicum',
}

export const EXAMPLE_ROW: SpreadsheetRowClient = {
  id: 'example',
  position: -1,
  week: '20265',  // YYYYW format (2026, week 5)
  invoiceDate: '01/01/2026',
  date: '31/12/2025',
  finalClient: 'Arico Fruits S.L',
  kg: '850',
  product: 'BASIL/ALBAHACA 1 KG',
  boxType: '1 kg',
  abono: '5',
  bundles: '170',
  price: '7.5',
  awb: '996-13826540',
  flightNumber: 'UX9117',
  destination: 'MAD AIRPORT',
  incoterm: 'CPT',
  deliveryNote: 'ALB-001',
  invoiceNumber: 'FAC-01012026',
  search: '',
}

export const HIGHLIGHT_STYLES = {
  match: { bg: 'bg-emerald-50', border: 'border-emerald-200' },
  autoCalc: { bg: 'bg-blue-50/40', text: 'text-gray-700' },
} as const

export const IATA_FLIGHT_REGEX = /^[A-Z0-9]{2}\d{1,4}$/i

export function getWeekString(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date()
  if (isNaN(date.getTime())) return ''
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.getTime()
  const jan4 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4)).getTime()
  const weekNum = 1 + Math.round((firstThursday - jan4) / (7 * 86400000))
  // Return YYYYW format (single digit for weeks 1-9, two digits for 10-52)
  return `${target.getUTCFullYear()}${weekNum}`
}

export function emptyRow(position: number): SpreadsheetRowClient {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  return {
    id: crypto.randomUUID(),
    position,
    week: getWeekString(today),
    invoiceDate: today,
    date: yesterdayStr,
    finalClient: '',
    kg: '',
    product: '',
    boxType: '',
    abono: '',
    bundles: '',
    price: '',
    awb: '',
    flightNumber: '',
    destination: '',
    incoterm: '',
    deliveryNote: '',
    invoiceNumber: '',
    search: '',
  }
}
