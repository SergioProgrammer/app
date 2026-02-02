import type { SpreadsheetRepository } from '../../domain/repositories/SpreadsheetRepository'
import type { UpdateSpreadsheetRequest } from '../dto/SpreadsheetRequest'
import { toSpreadsheetResponse, type SpreadsheetResponse } from '../dto/SpreadsheetResponse'

export class UpdateSpreadsheet {
  constructor(private readonly repository: SpreadsheetRepository) {}

  async execute(
    id: string,
    userId: string,
    request: UpdateSpreadsheetRequest,
  ): Promise<SpreadsheetResponse> {
    const spreadsheet = await this.repository.findById(id)
    if (!spreadsheet) {
      throw new Error('Spreadsheet not found')
    }
    if (spreadsheet.userId !== userId) {
      throw new Error('Forbidden')
    }

    if (request.name) {
      spreadsheet.rename(request.name)
    }
    if (request.headerData) {
      spreadsheet.updateHeaderData(request.headerData)
    }
    if (request.rows) {
      spreadsheet.updateRows(
        request.rows.map((row) => ({
          id: row.id ?? crypto.randomUUID(),
          spreadsheetId: id,
          position: row.position,
          data: {
            week: row.week ?? null,
            invoiceDate: row.invoiceDate ?? null,
            date: row.date ?? null,
            finalClient: row.finalClient ?? null,
            kg: row.kg ?? null,
            product: row.product ?? null,
            boxType: row.boxType ?? null,
            bundles: row.bundles ?? null,
            price: row.price ?? null,
            orderNumber: row.orderNumber ?? null,
            awb: row.awb ?? null,
            deliveryNote: row.deliveryNote ?? null,
            invoiceNumber: row.invoiceNumber ?? null,
            line: row.line ?? null,
            search: row.search ?? null,
          },
        })),
      )
    }

    await this.repository.update(spreadsheet)
    return toSpreadsheetResponse(spreadsheet)
  }
}
