'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export const dynamic = 'force-dynamic'

export default function CallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const supabase = createClient()

  useEffect(() => {
    async function checkSession() {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        setStatus('error')
      } else {
        setStatus('success')
      }
    }
    checkSession()
  }, [supabase])

  if (status === 'loading') {
    return <p>Verificando usuario...</p>
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <h1 className="text-xl font-bold text-red-600 mb-4">❌ Error al verificar</h1>
          <a href="/login" className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black">
            Ir al login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow text-center">
        <h1 className="text-xl font-bold text-green-600 mb-4">✅ Usuario verificado correctamente</h1>
        <a href="/dashboard" className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black">
          Ir al dashboard
        </a>
      </div>
    </div>
  )
}
