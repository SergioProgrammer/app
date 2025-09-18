'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/utils/supabase/client'
import TurnstileWidget from '@/components/TurnstileWidget'

// validación básica
const schema = z.object({
  email: z.string().email('Correo no válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type FormValues = z.infer<typeof schema>

declare global {
  interface Window {
    turnstile?: {
      getResponse?: () => string
    }
  }
}

export default function RegistroPage() {
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const supabase = createClient()

  async function onSubmit(values: FormValues) {
    setMsg(null)
    setErr(null)

    // 1) pedir token de Turnstile
    const token = window.turnstile?.getResponse?.()
    console.log('🟡 Token en el cliente:', token)

    // 2) mandarlo a nuestra API
    const verify = await fetch('/api/turnstile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(r => r.json())

    console.log('🟡 Respuesta de API /api/turnstile:', verify)

    if (!verify?.ok) {
      setErr('Verificación anti-bots falló')
      return
    }

    // 3) signup en Supabase
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/`,
      },
    })

    if (error) setErr(error.message)
    else setMsg('Cuenta creada. Revisa tu correo para confirmarla.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-4 border p-6 rounded"
      >
        <h1 className="text-xl font-bold">Registro</h1>

        <div>
          <input
            className="border w-full p-2 rounded"
            placeholder="Correo"
            type="email"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-red-600 text-sm">{errors.email.message}</p>
          )}
        </div>

        <div>
          <input
            className="border w-full p-2 rounded"
            placeholder="Contraseña"
            type="password"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-red-600 text-sm">{errors.password.message}</p>
          )}
        </div>

        {/* Widget Turnstile */}
        <TurnstileWidget />

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white w-full p-2 rounded"
        >
          {isSubmitting ? 'Creando...' : 'Crear cuenta'}
        </button>

        {msg && <p className="text-green-600 text-sm">{msg}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </form>
    </div>
  )
}
