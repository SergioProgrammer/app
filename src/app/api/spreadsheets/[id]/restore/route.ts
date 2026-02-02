import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/utils/supabase/server'
import { SupabaseSpreadsheetRepository } from '@/server/spreadsheets/infrastructure/persistence/SupabaseSpreadsheetRepository'
import { RestoreSpreadsheet } from '@/server/spreadsheets/application/use-cases/RestoreSpreadsheet'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const repository = new SupabaseSpreadsheetRepository(supabase)
  const useCase = new RestoreSpreadsheet(repository)

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
    throw error
  }
}
