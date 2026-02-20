import { Spreadsheet } from '../../domain/entities/Spreadsheet'
import type { SpreadsheetRepository } from '../../domain/repositories/SpreadsheetRepository'
import type { CreateSpreadsheetRequest } from '../dto/SpreadsheetRequest'
import { toSpreadsheetResponse, type SpreadsheetResponse } from '../dto/SpreadsheetResponse'

export class CreateSpreadsheet {
  constructor(private readonly repository: SpreadsheetRepository) {}

  async execute(request: CreateSpreadsheetRequest, userId: string): Promise<SpreadsheetResponse> {
    const now = new Date()
    const spreadsheet = new Spreadsheet({
      id: crypto.randomUUID(),
      name: request.name,
      userId,
      headerData: {},
      rows: [],
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    })

    await this.repository.save(spreadsheet)
    return toSpreadsheetResponse(spreadsheet)
  }
}
