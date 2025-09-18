import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { token } = await req.json()
  console.log('🟢 Token recibido en API:', token)

  if (!token) return NextResponse.json({ ok: false }, { status: 400 })

  const form = new URLSearchParams()
  form.append('secret', process.env.TURNSTILE_SECRET_KEY!)
  form.append('response', token)

  const r = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: form,
    }
  )
  const result = await r.json()
  console.log('🟢 Respuesta de Cloudflare:', result)

  return NextResponse.json({ ok: !!result.success })
}
