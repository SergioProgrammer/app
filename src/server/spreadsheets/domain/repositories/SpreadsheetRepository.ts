import type { Spreadsheet } from '../entities/Spreadsheet'
import type { DayOfWeek } from '../types'

export interface SpreadsheetRepository {
  findById(id: string): Promise<Spreadsheet | null>
  findAllByUser(userId: string): Promise<Spreadsheet[]>
  findArchivedByUser(userId: string): Promise<Spreadsheet[]>
  findLatestByDayOfWeek(userId: string, dayOfWeek: DayOfWeek): Promise<Spreadsheet | null>
  save(spreadsheet: Spreadsheet): Promise<void>
  update(spreadsheet: Spreadsheet): Promise<void>
  delete(id: string): Promise<void>
}
