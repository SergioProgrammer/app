import type { Spreadsheet } from '../entities/Spreadsheet'

export interface SpreadsheetRepository {
  findById(id: string): Promise<Spreadsheet | null>
  findAllByUser(userId: string): Promise<Spreadsheet[]>
  findArchivedByUser(userId: string): Promise<Spreadsheet[]>
  save(spreadsheet: Spreadsheet): Promise<void>
  update(spreadsheet: Spreadsheet): Promise<void>
  delete(id: string): Promise<void>
}
