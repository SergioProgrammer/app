import type { HeaderData, SpreadsheetProps, SpreadsheetRowProps } from '../types'

export class Spreadsheet {
  readonly id: string
  readonly userId: string
  readonly createdAt: Date

  private _name: string
  private _headerData: HeaderData
  private _rows: SpreadsheetRowProps[]
  private _updatedAt: Date
  private _archivedAt: Date | null

  constructor(props: SpreadsheetProps) {
    this.id = props.id
    this._name = props.name
    this.userId = props.userId
    this._headerData = props.headerData
    this._rows = props.rows
    this.createdAt = props.createdAt
    this._updatedAt = props.updatedAt
    this._archivedAt = props.archivedAt
  }

  get name(): string {
    return this._name
  }

  get headerData(): HeaderData {
    return this._headerData
  }

  get rows(): SpreadsheetRowProps[] {
    return this._rows
  }

  get updatedAt(): Date {
    return this._updatedAt
  }

  get archivedAt(): Date | null {
    return this._archivedAt
  }

  isArchived(): boolean {
    return this._archivedAt !== null
  }

  rename(name: string): void {
    this._name = name
    this._updatedAt = new Date()
  }

  updateHeaderData(data: HeaderData): void {
    this._headerData = data
    this._updatedAt = new Date()
  }

  updateRows(rows: SpreadsheetRowProps[]): void {
    this._rows = rows
    this._updatedAt = new Date()
  }

  archive(): void {
    this._archivedAt = new Date()
    this._updatedAt = new Date()
  }

  restore(): void {
    this._archivedAt = null
    this._updatedAt = new Date()
  }

  toProps(): SpreadsheetProps {
    return {
      id: this.id,
      name: this._name,
      userId: this.userId,
      headerData: this._headerData,
      rows: this._rows,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      archivedAt: this._archivedAt,
    }
  }
}
