import { Spreadsheet } from '../../domain/entities/Spreadsheet'
import type { SpreadsheetRepository } from '../../domain/repositories/SpreadsheetRepository'
import type { CreateSpreadsheetRequest } from '../dto/SpreadsheetRequest'
import { toSpreadsheetResponse, type SpreadsheetResponse } from '../dto/SpreadsheetResponse'

export class CreateSpreadsheet {
  constructor(private readonly repository: SpreadsheetRepository) {}

  async execute(request: CreateSpreadsheetRequest, userId: string): Promise<SpreadsheetResponse> {
    const now = new Date()
    const dayOfWeek = request.dayOfWeek ?? null

    let copiedHeaderData = {}
    let copiedRows: Spreadsheet['rows'] = []

    // Copy from previous spreadsheet of the same day if requested
    if (request.copyFromPrevious && dayOfWeek) {
      const previous = await this.repository.findLatestByDayOfWeek(userId, dayOfWeek)
      if (previous) {
        copiedHeaderData = { ...previous.headerData }
        copiedRows = previous.rows.map((row, idx) => ({
          ...row,
          id: crypto.randomUUID(),
          spreadsheetId: '', // Will be set below
          position: idx,
        }))
      }
    }

    const spreadsheetId = crypto.randomUUID()

    // Set the correct spreadsheetId on copied rows
    copiedRows = copiedRows.map((r) => ({ ...r, spreadsheetId }))

    const spreadsheet = new Spreadsheet({
      id: spreadsheetId,
      name: request.name,
      userId,
      headerData: copiedHeaderData,
      rows: copiedRows,
      dayOfWeek,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    })

    await this.repository.save(spreadsheet)
    return toSpreadsheetResponse(spreadsheet)
  }
}
