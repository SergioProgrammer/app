import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { code, redirectUri } = await req.json()

  const params = new URLSearchParams({
    code,
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  const tokenData = await res.json()

  if (tokenData.error) {
    return NextResponse.json({ error: tokenData.error }, { status: 400 })
  }

  // opcional: pedir info del usuario
  const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const meData = await meRes.json()

  return NextResponse.json({
    ...tokenData,
    email: meData.email,
  })
}
