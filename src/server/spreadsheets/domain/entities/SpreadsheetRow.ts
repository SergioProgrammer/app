import type { InvoiceItem } from '@/lib/invoice-pdf'
import type { SpreadsheetRowData, SpreadsheetRowProps } from '../types'

export class SpreadsheetRow {
  readonly id: string
  readonly spreadsheetId: string

  private _position: number
  private _data: SpreadsheetRowData

  constructor(props: SpreadsheetRowProps) {
    if (props.position < 0) {
      throw new Error('Row position must be >= 0')
    }
    this.id = props.id
    this.spreadsheetId = props.spreadsheetId
    this._position = props.position
    this._data = props.data
  }

  get position(): number {
    return this._position
  }

  get data(): SpreadsheetRowData {
    return this._data
  }

  setPosition(position: number): void {
    if (position < 0) {
      throw new Error('Row position must be >= 0')
    }
    this._position = position
  }

  update(data: Partial<SpreadsheetRowData>): void {
    this._data = { ...this._data, ...data }
  }

  toInvoiceItem(): InvoiceItem {
    return {
      product: this._data.product ?? '',
      netWeightKg: this._data.kg ?? 0,
      pricePerKg: this._data.price ?? 0,
      bundles: this._data.bundles ?? undefined,
      total:
        this._data.kg != null && this._data.price != null
          ? this._data.kg * this._data.price
          : undefined,
    }
  }

  toProps(): SpreadsheetRowProps {
    return {
      id: this.id,
      spreadsheetId: this.spreadsheetId,
      position: this._position,
      data: { ...this._data },
    }
  }
}
