import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { gmail, automationId } = await req.json()

  // 1. Buscar el user_id en gmail_accounts
  const { data: gmailAccount, error: gmailError } = await supabase
    .from('gmail_accounts')
    .select('user_id')
    .eq('gmail_address', gmail)
    .single()

  if (gmailError || !gmailAccount) {
    return NextResponse.json(
      { error: 'No account found for this Gmail' },
      { status: 404 }
    )
  }

  // 2. Buscar el prompt en user_automations
  const { data: automation, error: automationError } = await supabase
    .from('user_automations')
    .select('prompt')
    .eq('user_id', gmailAccount.user_id)
    .eq('automation_id', automationId)
    .single()

  if (automationError || !automation) {
    return NextResponse.json(
      { error: 'No automation found for this user' },
      { status: 404 }
    )
  }

  return NextResponse.json({ prompt: automation.prompt })
}
