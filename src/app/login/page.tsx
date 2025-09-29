'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import TurnstileWidget from '@/components/TurnstileWidget'

const schema = z.object({
  email: z.string().email('Correo no válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const [err, setErr] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const supabase = createClient()

  async function onSubmit(values: FormValues) {
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

    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      setErr(error.message)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen bg-[#f9f8f6] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.7)]">
        <div className="grid gap-y-10 lg:grid-cols-[1.25fr_1fr]">
          <aside className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-10 py-12 text-white">
            <div className="absolute right-10 top-10 h-36 w-36 rounded-full bg-white/5 blur-3xl" aria-hidden />
            <div className="relative space-y-10">
              <header className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  <Sparkles className="h-3 w-3" />
                  ProcesIA
                </span>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold leading-tight">Bienvenido de nuevo</h1>
                  <p className="text-sm text-white/70">
                    Accede al panel para monitorizar tus automatizaciones, revisar métricas y activar nuevos flujos sin salir de este entorno.
                  </p>
                </div>
              </header>

              <ul className="space-y-4 text-sm">
                {[{ icon: ShieldCheck, title: 'Sesiones seguras', copy: 'Protección con verificación anti-bots y gestión granular de equipo.' }, { icon: Lock, title: 'Control centralizado', copy: 'Configura permisos y flujos directamente desde el dashboard.' }, { icon: Mail, title: 'Alertas inteligentes', copy: 'Recibe incidencias y reportes clave sin saturar tu correo.' }].map(feature => (
                  <li key={feature.title} className="flex gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                      <feature.icon className="h-5 w-5" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">{feature.title}</p>
                      <p className="text-xs text-white/70">{feature.copy}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Promedio del mes</p>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-semibold">1.2K</p>
                    <p className="text-xs text-white/70">Procesos automatizados al día</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-200">+18%</p>
                    <p className="text-xs text-white/60">vs mes anterior</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="px-8 pb-10 pt-12 sm:px-12">
            <form onSubmit={handleSubmit(onSubmit)} className="mx-auto w-full max-w-md space-y-6">
              <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-2xl font-semibold text-gray-900">Iniciar sesión</h2>
                <p className="text-sm text-gray-600">
                  Introduce tus credenciales para continuar. ¿Necesitas una cuenta?{' '}
                  <a href="/registro" className="font-medium text-gray-900 underline underline-offset-4">
                    Regístrate aquí
                  </a>
                  .
                </p>
              </div>

              <div className="space-y-5">
                <label className="block space-y-2 text-sm font-medium text-gray-700">
                  Correo electrónico
                  <div className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm transition focus-within:border-gray-900 focus-within:ring-2 focus-within:ring-gray-900/10 ${errors.email ? 'border-red-400' : 'border-gray-200'}`}>
                    <Mail className="h-4 w-4 text-gray-400" />
                    <input
                      {...register('email')}
                      type="email"
                      autoComplete="email"
                      placeholder="tucorreo@empresa.com"
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
                      autoComplete="current-password"
                      placeholder="Introduce tu contraseña"
                      className="flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  {errors.password && <p className="text-xs font-normal text-red-500">{errors.password.message}</p>}
                </label>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-3 text-xs text-gray-500">
                  Activamos capas adicionales de seguridad para mantener las automatizaciones protegidas. Completa la verificación antes de continuar.
                </div>
                <TurnstileWidget onVerify={setCaptchaToken} />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:opacity-50"
              >
                {isSubmitting ? 'Entrando...' : 'Acceder al panel'}
              </button>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <a href="/forgot-password" className="font-medium text-gray-700 hover:text-gray-900">
                  ¿Olvidaste tu contraseña?
                </a>
                {err && <p className="text-right text-red-500">{err}</p>}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
