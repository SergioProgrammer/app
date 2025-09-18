import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const secret = process.env.TURNSTILE_SECRET_KEY!
  const ip = req.headers.get('CF-Connecting-IP') ?? ''

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    }
  )

  const data = await response.json()
  console.log('🔐 Turnstile response:', data)

  if (data.success) {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false }, { status: 400 })
}
