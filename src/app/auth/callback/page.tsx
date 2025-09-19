'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function CallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const supabase = createClient()

  useEffect(() => {
    async function checkSession() {
      // intenta recuperar la sesión después de la verificación
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6]">
        <p className="text-gray-500">Verificando usuario...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6]">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <h1 className="text-xl font-bold text-red-600 mb-4">❌ Error al verificar</h1>
          <p className="mb-6 text-gray-600">
            El enlace no es válido o ya fue usado. Intenta iniciar sesión de nuevo.
          </p>
          <a
            href="/login"
            className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black"
          >
            Ir al login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6]">
      <div className="bg-white p-8 rounded-xl shadow text-center">
        <h1 className="text-xl font-bold text-green-600 mb-4">✅ Usuario verificado correctamente</h1>
        <p className="mb-6 text-gray-600">
          Ya puedes acceder a tu panel de control.
        </p>
        <a
          href="/dashboard"
          className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black"
        >
          Ir al dashboard
        </a>
      </div>
    </div>
  )
}
