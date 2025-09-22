'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

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
        } else {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            // Insertar o actualizar credenciales en gmail_accounts
            await supabase.from('gmail_accounts').upsert({
              user_id: user.id,
              gmail_address: data.email,
              access_token: data.access_token,
              refresh_token: data.refresh_token,
            })
          }

          setStatus('✅ Gmail conectado correctamente.')
          setTimeout(() => {
            window.location.href = '/automatizaciones/responder-emails'
          }, 2000)
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
            setStatus('Error al conectar: ' + err.message)
        } else {
            setStatus('Error desconocido')
        }
        }

    }

    exchangeCode()
  }, [])

  return <p className="p-6">{status}</p>
}
