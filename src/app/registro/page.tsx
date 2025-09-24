'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/utils/supabase/client'
import TurnstileWidget from '@/components/TurnstileWidget'

const schema = z.object({
  email: z.string().email('Correo no válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type FormValues = z.infer<typeof schema>

export default function RegistroPage() {
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const supabase = createClient()

  async function onSubmit(values: FormValues) {
    setMsg(null)
    setErr(null)

    if (!captchaToken) {
      setErr('Por favor completa la verificación anti-bots')
      return
    }

    const verify = await fetch('/api/turnstile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: captchaToken }),
    }).then(r => r.json())

    if (!verify?.ok) {
      setErr(`Verificación anti-bots falló: ${verify.error}`)
      return
    }

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) setErr(error.message)
    else setMsg('Cuenta creada. Revisa tu correo 📩')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6] p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm bg-white border rounded-2xl shadow p-8 space-y-4"
      >
        <h1 className="text-xl font-bold text-gray-900">Registro</h1>

        <input
          {...register('email')}
          type="email"
          placeholder="Correo"
          className="w-full border rounded-lg p-3"
        />
        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}

        <input
          {...register('password')}
          type="password"
          placeholder="Contraseña"
          className="w-full border rounded-lg p-3"
        />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}

        {/* Captcha: solo guarda el token */}
        <TurnstileWidget onVerify={setCaptchaToken} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gray-900 text-white p-3 rounded-lg font-semibold hover:bg-black"
        >
          {isSubmitting ? 'Creando...' : 'Crear cuenta'}
        </button>

        {msg && <p className="text-green-600 text-sm">{msg}</p>}
        {err && <p className="text-red-500 text-sm">{err}</p>}
      </form>
    </div>
  )
}
