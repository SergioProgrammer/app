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
    console.error('Error en token exchange:', tokenData)
    return NextResponse.json({ error: tokenData.error_description || tokenData.error }, { status: 400 })
  }

  // Pedir info del usuario
  
        // Pedir info del usuario con OpenID
// Usamos el endpoint de Gmail directamente
const meRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
  headers: { Authorization: `Bearer ${tokenData.access_token}` },
})
const meData = await meRes.json()

return NextResponse.json({
  ...tokenData,
  email: meData.emailAddress, // Gmail devuelve "emailAddress"
})



  console.log('✅ Token Data:', tokenData)
  console.log('✅ User Info:', meData)

  return NextResponse.json({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
  })
}
