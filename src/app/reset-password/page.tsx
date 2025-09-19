'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/utils/supabase/client'

const schema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
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

    const { error } = await supabase.auth.updateUser({ password: values.password })

    if (error) setErr(error.message)
    else {
      setMsg('✅ Contraseña cambiada correctamente. Ya puedes iniciar sesión.')
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6] p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm bg-white border rounded-2xl shadow p-8 space-y-4"
      >
        <h1 className="text-xl font-bold text-gray-900">Nueva contraseña</h1>

        <input
          {...register('password')}
          type="password"
          placeholder="Escribe tu nueva contraseña"
          className="w-full border rounded-lg p-3"
        />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gray-900 text-white p-3 rounded-lg font-semibold hover:bg-black"
        >
          {isSubmitting ? 'Guardando...' : 'Cambiar contraseña'}
        </button>

        {msg && <p className="text-green-600 text-sm">{msg}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </form>
    </div>
  )
}
