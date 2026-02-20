import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/utils/supabase/server'
import { SupabaseSpreadsheetRepository } from '@/server/spreadsheets/infrastructure/persistence/SupabaseSpreadsheetRepository'
import { toSpreadsheetListItem } from '@/server/spreadsheets/application/dto/SpreadsheetResponse'

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerSupabaseClient()
  const repository = new SupabaseSpreadsheetRepository(supabase)
  const spreadsheets = await repository.findArchivedByUser(user.id)

  return NextResponse.json(spreadsheets.map(toSpreadsheetListItem))
}
