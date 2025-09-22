'use client'

import { useEffect } from 'react'

export default function GoogleAuthPage() {
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const redirectUri = `${window.location.origin}/auth/google/callback`
    const scope = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ].join(' ')

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`

    window.location.href = authUrl
  }, [])

  return <p className="p-6">Redirigiendo a Google...</p>
}
