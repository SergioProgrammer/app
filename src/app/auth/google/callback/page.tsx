'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const ALLOWED_EMAILS_TABLE = process.env.NEXT_PUBLIC_ALLOWED_EMAILS_TABLE ?? 'allowed_emails'

export default function GoogleCallbackPage() {
  const [status, setStatus] = useState('Procesando...')

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    if (!code) {
      setStatus('Error: no se recibió el código de Google')
      return
    }

    async function exchangeCode() {
      try {
        const res = await fetch('/api/google/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/auth/google/callback`,
          }),
        })

        const data = await res.json()
        if (data.error) {
          setStatus('Error: ' + data.error)
          return
        }

        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          await supabase.from(ALLOWED_EMAILS_TABLE).upsert({
            user_id: user.id,
            gmail_address: data.email,
            email: data.email,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          })
        }

        setStatus('✅ Gmail conectado correctamente.')
        setTimeout(() => {
          window.location.href = '/automations/responder-emails'
        }, 2000)
      } catch (err: unknown) {
        setStatus(err instanceof Error ? err.message : 'Error desconocido')
      }
    }

    exchangeCode()
  }, [])

  return <p className="p-6">{status}</p>
}
