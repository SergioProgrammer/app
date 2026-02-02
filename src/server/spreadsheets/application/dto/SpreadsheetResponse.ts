import type { Spreadsheet } from '../../domain/entities/Spreadsheet'

export interface SpreadsheetListItemResponse {
  id: string
  name: string
  rowCount: number
  updatedAt: string
}

export interface SpreadsheetRowResponse {
  id: string
  position: number
  week: string | null
  invoiceDate: string | null
  date: string | null
  finalClient: string | null
  kg: number | null
  product: string | null
  boxType: string | null
  bundles: number | null
  price: number | null
  orderNumber: string | null
  awb: string | null
  deliveryNote: string | null
  invoiceNumber: string | null
  line: string | null
  search: string | null
}

export interface SpreadsheetResponse {
  id: string
  name: string
  headerData: Record<string, string | undefined>
  rows: SpreadsheetRowResponse[]
  createdAt: string
  updatedAt: string
}

export function toSpreadsheetResponse(entity: Spreadsheet): SpreadsheetResponse {
  return {
    id: entity.id,
    name: entity.name,
    headerData: entity.headerData,
    rows: entity.rows.map((row) => ({
      id: row.id,
      position: row.position,
      ...row.data,
    })),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  }
}

export function toSpreadsheetListItem(entity: Spreadsheet): SpreadsheetListItemResponse {
  return {
    id: entity.id,
    name: entity.name,
    rowCount: entity.rows.length,
    updatedAt: entity.updatedAt.toISOString(),
  }
}