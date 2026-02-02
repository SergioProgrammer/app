export type SaveStatus = 'saved' | 'saving' | 'unsaved'

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

export const SPREADSHEET_COLUMNS = [
  { key: 'week', label: 'Semana', width: 80 },
  { key: 'invoiceDate', label: 'Fecha factura', width: 110 },
  { key: 'date', label: 'Fecha', width: 100 },
  { key: 'finalClient', label: 'Cliente final', width: 140 },
  { key: 'kg', label: 'Kg', width: 80 },
  { key: 'product', label: 'Producto', width: 140 },
  { key: 'boxType', label: 'Tipo caja', width: 100 },
  { key: 'bundles', label: 'Bultos', width: 70 },
  { key: 'price', label: 'Precio', width: 90 },
  { key: 'orderNumber', label: 'Nº pedido', width: 100 },
  { key: 'awb', label: 'AWB', width: 120 },
  { key: 'deliveryNote', label: 'Albarán', width: 100 },
  { key: 'invoiceNumber', label: 'Nº factura', width: 110 },
  { key: 'line', label: 'Línea', width: 80 },
  { key: 'search', label: 'Búsqueda', width: 100 },
] as const

export type SpreadsheetColumnKey = (typeof SPREADSHEET_COLUMNS)[number]['key']

export const EMPTY_HEADER: HeaderDataClient = {
  invoiceNumber: '',
  invoiceDate: '',
  clientName: '',
  clientTaxId: '',
  clientAddress: '',
  emitterName: '',
  emitterTaxId: '',
  emitterAddress: '',
  destination: '',
  incoterm: '',
  awb: '',
  flightNumber: '',
  paymentTerms: '',
  bankName: '',
  bankIban: '',
  bankSwift: '',
  productForm: '',
  botanicalName: '',
}

export function emptyRow(position: number): SpreadsheetRowClient {
  return {
    id: crypto.randomUUID(),
    position,
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
