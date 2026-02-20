import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/utils/supabase/server'
import { SupabaseSpreadsheetRepository } from '@/server/spreadsheets/infrastructure/persistence/SupabaseSpreadsheetRepository'
import { CreateSpreadsheet } from '@/server/spreadsheets/application/use-cases/CreateSpreadsheet'
import { CreateSpreadsheetSchema } from '@/server/spreadsheets/application/dto/SpreadsheetRequest'
import { toSpreadsheetListItem } from '@/server/spreadsheets/application/dto/SpreadsheetResponse'

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerSupabaseClient()
  const repository = new SupabaseSpreadsheetRepository(supabase)
  const spreadsheets = await repository.findAllByUser(user.id)

  return NextResponse.json(spreadsheets.map(toSpreadsheetListItem))
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateSpreadsheetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const repository = new SupabaseSpreadsheetRepository(supabase)
  const useCase = new CreateSpreadsheet(repository)
  const result = await useCase.execute(parsed.data, user.id)

  return NextResponse.json(result, { status: 201 })
}
