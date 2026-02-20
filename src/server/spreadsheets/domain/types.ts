export interface SpreadsheetRowData {
  week: string | null
  invoiceDate: string | null
  date: string | null
  finalClient: string | null
  kg: number | null
  product: string | null
  boxType: string | null
  abono: number | null
  bundles: number | null
  price: number | null
  orderNumber: string | null
  awb: string | null
  deliveryNote: string | null
  invoiceNumber: string | null
  line: string | null
  search: string | null
}

export interface SpreadsheetRowProps {
  id: string
  spreadsheetId: string
  position: number
  data: SpreadsheetRowData
}

export interface HeaderData {
  invoiceNumber?: string
  invoiceDate?: string
  clientName?: string
  clientTaxId?: string
  clientAddress?: string
  emitterName?: string
  emitterTaxId?: string
  emitterAddress?: string
  destination?: string
  incoterm?: string
  awb?: string
  flightNumber?: string
  paymentTerms?: string
  bankName?: string
  bankIban?: string
  bankSwift?: string
  productForm?: string
  botanicalName?: string
}

export interface SpreadsheetProps {
  id: string
  name: string
  userId: string
  headerData: HeaderData
  rows: SpreadsheetRowProps[]
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}
