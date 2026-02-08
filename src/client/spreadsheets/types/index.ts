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
  bundles: string
  price: string
  orderNumber: string
  awb: string
  deliveryNote: string
  invoiceNumber: string
  line: string
  search: string
}

export interface HeaderDataClient {
  invoiceNumber: string
  invoiceDate: string
  clientName: string
  clientTaxId: string
  clientAddress: string
  emitterName: string
  emitterTaxId: string
  emitterAddress: string
  destination: string
  incoterm: string
  awb: string
  flightNumber: string
  paymentTerms: string
  bankName: string
  bankIban: string
  bankSwift: string
  productForm: string
  botanicalName: string
}

export interface SpreadsheetListItem {
  id: string
  name: string
  rowCount: number
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
  { key: 'week', label: 'Semana', width: 80, inputType: 'text' as ColumnInputType },
  { key: 'invoiceDate', label: 'Fecha factura', width: 140, inputType: 'date' as ColumnInputType },
  { key: 'date', label: 'Fecha corte', width: 140, inputType: 'date' as ColumnInputType },
  { key: 'finalClient', label: 'Cliente final', width: 140, inputType: 'text' as ColumnInputType },
  { key: 'kg', label: 'Kg', width: 80, inputType: 'number' as ColumnInputType },
  { key: 'product', label: 'Producto', width: 140, inputType: 'text' as ColumnInputType },
  { key: 'boxType', label: 'Tipo caja', width: 100, inputType: 'text' as ColumnInputType },
  { key: 'bundles', label: 'Bultos', width: 70, inputType: 'number' as ColumnInputType },
  { key: 'price', label: 'Precio', width: 90, inputType: 'number' as ColumnInputType },
  { key: 'orderNumber', label: 'Nº pedido', width: 100, inputType: 'text' as ColumnInputType },
  { key: 'awb', label: 'AWB', width: 120, inputType: 'text' as ColumnInputType },
  { key: 'deliveryNote', label: 'Albarán', width: 100, inputType: 'text' as ColumnInputType },
  { key: 'invoiceNumber', label: 'Nº factura', width: 110, inputType: 'text' as ColumnInputType },
  { key: 'line', label: 'Línea', width: 80, inputType: 'text' as ColumnInputType },
  { key: 'search', label: 'Búsqueda', width: 100, inputType: 'text' as ColumnInputType },
] as const

export type SpreadsheetColumnKey = (typeof SPREADSHEET_COLUMNS)[number]['key']

export const REQUIRED_ROW_FIELDS: SpreadsheetColumnKey[] = ['product', 'kg', 'price']

export const DEFAULT_HEADER: HeaderDataClient = {
  invoiceNumber: '',
  invoiceDate: '',
  clientName: 'ARICO FRUITS SL',
  clientTaxId: 'B24895971',
  clientAddress: 'MERCAMADRID NAVE POLIVALENCIA 21/23 · 28053 · MADRID',
  emitterName: 'YEOWARD DEL CAMPO SDAD COOP LTDA DE VECINDARIO LAS PALMAS',
  emitterTaxId: 'F35077700',
  emitterAddress: 'AVDA CANARIAS NUM 249 · 35110 SANTA LUCIA DE TIRAJANA · LAS PALMAS DE GRAN CANARIA',
  destination: 'MAD AIRPORT',
  incoterm: 'CPT',
  awb: '996-13826540',
  flightNumber: 'UX9117',
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
  week: '20265',
  invoiceDate: '01/01/2026',
  date: '01/01/2026',
  finalClient: 'Arico Fruits S.L',
  kg: '850',
  product: 'BASIL/ALBAHACA 1 KG',
  boxType: '1 kg',
  bundles: '180',
  price: '7.5',
  orderNumber: '20261',
  awb: '996-13826540',
  deliveryNote: 'ALB-001',
  invoiceNumber: 'FAC-01012026',
  line: '1',
  search: '',
}

export function getWeekString(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date()
  if (isNaN(date.getTime())) return ''
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.getTime()
  const jan4 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4)).getTime()
  const weekNum = 1 + Math.round((firstThursday - jan4) / (7 * 86400000))
  return `${target.getUTCFullYear()}${weekNum}`
}

export function emptyRow(position: number): SpreadsheetRowClient {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: crypto.randomUUID(),
    position,
    week: getWeekString(today),
    invoiceDate: today,
    date: today,
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
