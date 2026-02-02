import type { SpreadsheetRepository } from '../../domain/repositories/SpreadsheetRepository'

export class DeleteSpreadsheet {
  constructor(private readonly repository: SpreadsheetRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    const spreadsheet = await this.repository.findById(id)
    if (!spreadsheet) {
      throw new Error('Spreadsheet not found')
    }
    if (spreadsheet.userId !== userId) {
      throw new Error('Forbidden')
    }
    if (!spreadsheet.isArchived()) {
      throw new Error('Only archived spreadsheets can be permanently deleted')
    }

    await this.repository.delete(id)
  }
}
