'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Clock3, Lock, Mail, Sparkles, UserPlus } from 'lucide-react'
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

    // Verificación anti-bots
    const verify = await fetch('/api/turnstile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: captchaToken }),
    }).then(r => r.json())

    if (!verify?.ok) {
      setErr(`Verificación anti-bots falló: ${verify.error}`)
      return
    }

    // 1️⃣ Registrar en Supabase
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      setErr(error.message)
      return
    }

    // 2️⃣ Enviar notificación a tu correo solo si el registro fue OK
    try {
      await fetch('https://formsubmit.co/ajax/saraquintanadg@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: values.email,
          subject: 'Nuevo registro en ProcesIA',
          message: `📩 Se ha registrado un nuevo usuario: ${values.email}.
Recuerda validarlo en Google Console antes de que pueda usar Gmail.`,
        }),
      })
    } catch (e) {
      console.error('Error al enviar notificación:', e)
    }

    // 3️⃣ Aviso al usuario
    setMsg(
      '✅ Cuenta creada. Revisa tu correo para confirmar. Después recibirás nuestro email de activación para acceder a las automatizaciones.'
    )
  }

  return (
    <div className="min-h-screen bg-[#f9f8f6] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.7)]">
        <div className="grid gap-y-10 lg:grid-cols-[1.25fr_1fr]">
          <aside className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-10 py-12 text-white">
            <div className="absolute right-12 top-8 h-32 w-32 rounded-full bg-white/5 blur-3xl" aria-hidden />
            <div className="relative space-y-10">
              <header className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  <Sparkles className="h-3 w-3" />
                  Nueva cuenta
                </span>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold leading-tight">Activa tu acceso a ProcesIA</h1>
                  <p className="text-sm text-white/70">
                    Prepara tus automatizaciones desde un entorno seguro. Te guiamos en la activación para que puedas orquestar flujos, monitorizar resultados y escalar sin fricciones.
                  </p>
                </div>
              </header>

              <ul className="space-y-4 text-sm">
                {[{ icon: UserPlus, title: 'Onboarding asistido', copy: 'Recibe un correo con los próximos pasos y recomendaciones personalizadas.' }, { icon: CheckCircle2, title: 'Plantillas listas', copy: 'Accede a un catálogo curado para operaciones, atención al cliente y analítica.' }, { icon: Clock3, title: 'Activación en 48h', copy: 'Sincronizamos tus credenciales y revisamos la configuración inicial contigo.' }].map(highlight => (
                  <li key={highlight.title} className="flex gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                      <highlight.icon className="h-5 w-5" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">{highlight.title}</p>
                      <p className="text-xs text-white/70">{highlight.copy}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Checklist inicial</p>
                <div className="mt-3 space-y-2 text-xs text-white/70">
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-emerald-200" />
                    Confirma tu correo para habilitar el acceso al panel.
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200" />
                    Valida credenciales en Google Console si usarás Gmail.
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock3 className="h-3.5 w-3.5 text-emerald-200" />
                    Recibirás confirmación manual antes de activar las automatizaciones.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="px-8 pb-10 pt-12 sm:px-12">
            <form onSubmit={handleSubmit(onSubmit)} className="mx-auto w-full max-w-md space-y-6">
              <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-2xl font-semibold text-gray-900">Crea tu cuenta</h2>
                <p className="text-sm text-gray-600">
                  Inicia la verificación para obtener acceso al panel. ¿Ya tienes cuenta?{' '}
                  <a href="/login" className="font-medium text-gray-900 underline underline-offset-4">
                    Inicia sesión aquí
                  </a>
                  .
                </p>
              </div>

              <div className="space-y-5">
                <label className="block space-y-2 text-sm font-medium text-gray-700">
                  Correo electrónico corporativo
                  <div className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm transition focus-within:border-gray-900 focus-within:ring-2 focus-within:ring-gray-900/10 ${errors.email ? 'border-red-400' : 'border-gray-200'}`}>
                    <Mail className="h-4 w-4 text-gray-400" />
                    <input
                      {...register('email')}
                      type="email"
                      autoComplete="email"
                      placeholder="operaciones@tuempresa.com"
                      className="flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  {errors.email && <p className="text-xs font-normal text-red-500">{errors.email.message}</p>}
                </label>

                <label className="block space-y-2 text-sm font-medium text-gray-700">
                  Contraseña
                  <div className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm transition focus-within:border-gray-900 focus-within:ring-2 focus-within:ring-gray-900/10 ${errors.password ? 'border-red-400' : 'border-gray-200'}`}>
                    <Lock className="h-4 w-4 text-gray-400" />
                    <input
                      {...register('password')}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      className="flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  {errors.password && <p className="text-xs font-normal text-red-500">{errors.password.message}</p>}
                </label>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-3 text-xs text-gray-500">
                  Necesitamos confirmar que eres humano antes de enviarte la verificación de acceso. Completa el desafío para continuar.
                </div>
                <TurnstileWidget onVerify={setCaptchaToken} />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:opacity-50"
              >
                {isSubmitting ? 'Creando...' : 'Solicitar acceso'}
              </button>

              {(msg || err) && (
                <div className="space-y-2 text-xs">
                  {msg && <p className="rounded-lg bg-emerald-50 px-4 py-3 font-medium text-emerald-700">{msg}</p>}
                  {err && <p className="rounded-lg bg-red-50 px-4 py-3 font-medium text-red-600">{err}</p>}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
