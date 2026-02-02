import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/utils/supabase/server'
import { SupabaseSpreadsheetRepository } from '@/server/spreadsheets/infrastructure/persistence/SupabaseSpreadsheetRepository'
import { UpdateSpreadsheet } from '@/server/spreadsheets/application/use-cases/UpdateSpreadsheet'
import { DeleteSpreadsheet } from '@/server/spreadsheets/application/use-cases/DeleteSpreadsheet'
import { UpdateSpreadsheetSchema } from '@/server/spreadsheets/application/dto/SpreadsheetRequest'
import { toSpreadsheetResponse } from '@/server/spreadsheets/application/dto/SpreadsheetResponse'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const repository = new SupabaseSpreadsheetRepository(supabase)
  const spreadsheet = await repository.findById(id)

  if (!spreadsheet) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (spreadsheet.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(toSpreadsheetResponse(spreadsheet))
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = UpdateSpreadsheetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const repository = new SupabaseSpreadsheetRepository(supabase)
  const useCase = new UpdateSpreadsheet(repository)

  try {
    const result = await useCase.execute(id, user.id, parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Spreadsheet not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw error
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const repository = new SupabaseSpreadsheetRepository(supabase)
  const useCase = new DeleteSpreadsheet(repository)

  try {
    await useCase.execute(id, user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Spreadsheet not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'Only archived spreadsheets can be permanently deleted') {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    throw error
  }
}
