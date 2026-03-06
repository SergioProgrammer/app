import type { SupabaseClient } from '@supabase/supabase-js'
import { Spreadsheet } from '../../domain/entities/Spreadsheet'
import type { SpreadsheetRepository } from '../../domain/repositories/SpreadsheetRepository'
import type { DayOfWeek, HeaderData, SpreadsheetRowData, SpreadsheetRowProps } from '../../domain/types'

interface SpreadsheetDbRow {
  id: string
  name: string
  user_id: string
  header_data: Record<string, unknown>
  day_of_week: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

interface SpreadsheetRowDbRow {
  id: string
  spreadsheet_id: string
  position: number
  week: string | null
  invoice_date: string | null
  date: string | null
  final_client: string | null
  kg: number | null
  product: string | null
  box_type: string | null
  abono: number | null
  bundles: number | null
  price: number | null
  order_number: string | null
  awb: string | null
  flight_number: string | null
  delivery_note: string | null
  invoice_number: string | null
  line: string | null
  search: string | null
}

function dbRowToData(row: SpreadsheetRowDbRow): SpreadsheetRowData {
  return {
    week: row.week,
    invoiceDate: row.invoice_date,
    date: row.date,
    finalClient: row.final_client,
    kg: row.kg,
    product: row.product,
    boxType: row.box_type,
    abono: row.abono,
    bundles: row.bundles,
    price: row.price,
    orderNumber: row.order_number,
    awb: row.awb,
    flightNumber: row.flight_number,
    deliveryNote: row.delivery_note,
    invoiceNumber: row.invoice_number,
    line: row.line,
    search: row.search,
  }
}

function dataToDbRow(
  row: SpreadsheetRowProps,
): Omit<SpreadsheetRowDbRow, 'id'> & { id?: string } {
  return {
    id: row.id,
    spreadsheet_id: row.spreadsheetId,
    position: row.position,
    week: row.data.week,
    invoice_date: row.data.invoiceDate,
    date: row.data.date,
    final_client: row.data.finalClient,
    kg: row.data.kg,
    product: row.data.product,
    box_type: row.data.boxType,
    abono: row.data.abono,
    bundles: row.data.bundles,
    price: row.data.price,
    order_number: row.data.orderNumber,
    awb: row.data.awb,
    flight_number: row.data.flightNumber,
    delivery_note: row.data.deliveryNote,
    invoice_number: row.data.invoiceNumber,
    line: row.data.line,
    search: row.data.search,
  }
}

function toEntity(db: SpreadsheetDbRow, dbRows: SpreadsheetRowDbRow[]): Spreadsheet {
  return new Spreadsheet({
    id: db.id,
    name: db.name,
    userId: db.user_id,
    headerData: (db.header_data ?? {}) as HeaderData,
    rows: dbRows.map((r) => ({
      id: r.id,
      spreadsheetId: r.spreadsheet_id,
      position: r.position,
      data: dbRowToData(r),
    })),
    dayOfWeek: (db.day_of_week as DayOfWeek) ?? null,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
    archivedAt: db.archived_at ? new Date(db.archived_at) : null,
  })
}

function buildFakeRows(count: number, spreadsheetId: string): SpreadsheetRowDbRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `fake-${i}`,
    spreadsheet_id: spreadsheetId,
    position: i,
    week: null,
    invoice_date: null,
    date: null,
    final_client: null,
    kg: null,
    product: null,
    box_type: null,
    abono: null,
    bundles: null,
    price: null,
    order_number: null,
    awb: null,
    flight_number: null,
    delivery_note: null,
    invoice_number: null,
    line: null,
    search: null,
  }))
}

export class SupabaseSpreadsheetRepository implements SpreadsheetRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<Spreadsheet | null> {
    const { data: spreadsheet, error } = await this.supabase
      .from('spreadsheets')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch spreadsheet: ${error.message}`)
    if (!spreadsheet) return null

    const { data: rows, error: rowsError } = await this.supabase
      .from('spreadsheet_rows')
      .select('*')
      .eq('spreadsheet_id', id)
      .order('position', { ascending: true })

    if (rowsError) throw new Error(`Failed to fetch rows: ${rowsError.message}`)

    return toEntity(spreadsheet as SpreadsheetDbRow, (rows ?? []) as SpreadsheetRowDbRow[])
  }

  async findAllByUser(userId: string): Promise<Spreadsheet[]> {
    const { data, error } = await this.supabase
      .from('spreadsheets')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })

    if (error) throw new Error(`Failed to list spreadsheets: ${error.message}`)

    const spreadsheets = data ?? []
    return Promise.all(
      spreadsheets.map(async (s: SpreadsheetDbRow) => {
        const { count, error: countError } = await this.supabase
          .from('spreadsheet_rows')
          .select('*', { count: 'exact', head: true })
          .eq('spreadsheet_id', s.id)

        if (countError) {
          console.error(`Failed to count rows for spreadsheet ${s.id}:`, countError.message)
          return toEntity(s, [])
        }

        return toEntity(s, buildFakeRows(count ?? 0, s.id))
      })
    )
  }

  async findArchivedByUser(userId: string): Promise<Spreadsheet[]> {
    const { data, error } = await this.supabase
      .from('spreadsheets')
      .select('*')
      .eq('user_id', userId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })

    if (error) throw new Error(`Failed to list archived spreadsheets: ${error.message}`)

    const spreadsheets = data ?? []
    return Promise.all(
      spreadsheets.map(async (s: SpreadsheetDbRow) => {
        const { count, error: countError } = await this.supabase
          .from('spreadsheet_rows')
          .select('*', { count: 'exact', head: true })
          .eq('spreadsheet_id', s.id)

        if (countError) {
          console.error(`Failed to count rows for spreadsheet ${s.id}:`, countError.message)
          return toEntity(s, [])
        }

        return toEntity(s, buildFakeRows(count ?? 0, s.id))
      })
    )
  }

  async findLatestByDayOfWeek(userId: string, dayOfWeek: DayOfWeek): Promise<Spreadsheet | null> {
    const { data, error } = await this.supabase
      .from('spreadsheets')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to find latest by day: ${error.message}`)
    if (!data) return null

    // Fetch full rows for copying
    const { data: rows, error: rowsError } = await this.supabase
      .from('spreadsheet_rows')
      .select('*')
      .eq('spreadsheet_id', data.id)
      .order('position', { ascending: true })

    if (rowsError) throw new Error(`Failed to fetch rows: ${rowsError.message}`)

    return toEntity(data as SpreadsheetDbRow, (rows ?? []) as SpreadsheetRowDbRow[])
  }

  async save(spreadsheet: Spreadsheet): Promise<void> {
    const props = spreadsheet.toProps()
    const { error } = await this.supabase.from('spreadsheets').insert({
      id: props.id,
      name: props.name,
      user_id: props.userId,
      header_data: props.headerData,
      day_of_week: props.dayOfWeek,
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
      archived_at: props.archivedAt?.toISOString() ?? null,
    })

    if (error) throw new Error(`Failed to save spreadsheet: ${error.message}`)

    if (props.rows.length > 0) {
      const { error: rowsError } = await this.supabase
        .from('spreadsheet_rows')
        .insert(props.rows.map(dataToDbRow))

      if (rowsError) throw new Error(`Failed to save rows: ${rowsError.message}`)
    }
  }

  async update(spreadsheet: Spreadsheet): Promise<void> {
    const props = spreadsheet.toProps()
    const { error } = await this.supabase
      .from('spreadsheets')
      .update({
        name: props.name,
        header_data: props.headerData,
        day_of_week: props.dayOfWeek,
        updated_at: props.updatedAt.toISOString(),
        archived_at: props.archivedAt?.toISOString() ?? null,
      })
      .eq('id', props.id)

    if (error) throw new Error(`Failed to update spreadsheet: ${error.message}`)

    // Replace all rows: delete existing, insert new
    const { error: deleteError } = await this.supabase
      .from('spreadsheet_rows')
      .delete()
      .eq('spreadsheet_id', props.id)

    if (deleteError) throw new Error(`Failed to delete existing rows: ${deleteError.message}`)

    if (props.rows.length > 0) {
      const { error: insertError } = await this.supabase
        .from('spreadsheet_rows')
        .insert(props.rows.map(dataToDbRow))

      if (insertError) throw new Error(`Failed to insert rows: ${insertError.message}`)
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('spreadsheets')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete spreadsheet: ${error.message}`)
  }
}
