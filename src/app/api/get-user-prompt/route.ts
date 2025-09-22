import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/client'

export async function POST(req: Request) {
  try {
    const { gmail, automationId } = await req.json()

    if (!gmail || !automationId) {
      return NextResponse.json(
        { error: 'Missing gmail or automationId' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // 1. Buscar el user_id con ese Gmail
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

    // 2. Buscar el prompt con el automationId
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

    return NextResponse.json({
      prompt: automation.prompt,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
