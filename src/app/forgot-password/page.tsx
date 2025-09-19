'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/utils/supabase/client'

const schema = z.object({
  email: z.string().email('Correo no válido'),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setMsg(null)
    setErr(null)

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${location.origin}/reset-password`,
    })

    if (error) setErr(error.message)
    else setMsg('📩 Te hemos enviado un enlace para restablecer tu contraseña.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6] p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm bg-white border rounded-2xl shadow p-8 space-y-4"
      >
        <h1 className="text-xl font-bold text-gray-900">Recuperar contraseña</h1>

        <input
          {...register('email')}
          type="email"
          placeholder="Correo"
          className="w-full border rounded-lg p-3"
        />
        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gray-900 text-white p-3 rounded-lg font-semibold hover:bg-black"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
        </button>

        {msg && <p className="text-green-600 text-sm">{msg}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </form>
    </div>
  )
}
