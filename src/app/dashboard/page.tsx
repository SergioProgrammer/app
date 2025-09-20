'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { LucideIcon } from 'lucide-react'
import {
  CreditCard,
  Workflow,
  Settings,
  BarChart,
  Zap,
  Mail,
  ShoppingCart,
  FileSpreadsheet,
  Bell,
  Megaphone,
  Search,
} from 'lucide-react'

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/login'
      } else {
        setUser(session.user)
      }
    }
    loadUser()
  }, [supabase])

  type AutomationTemplate = {
    id: string
    name: string
    description: string
    icon: LucideIcon
    accentBg: string
    accentIcon: string
    href: string
    badges?: string[]
  }

  const templates: AutomationTemplate[] = [
    {
      id: 'email-bienvenida',
      name: 'Email de bienvenida',
      description:
        'Envía automáticamente un correo de bienvenida cuando un usuario se registra.',
      icon: Mail,
      accentBg: 'bg-rose-100',
      accentIcon: 'text-rose-600',
      href: '/automatizaciones/email-bienvenida',
      badges: ['Gratis', 'Básica'],
    },
    {
      id: 'carrito-abandonado',
      name: 'Recordatorio de carrito',
      description:
        'Detecta carritos abandonados y envía un recordatorio después de 24 horas.',
      icon: ShoppingCart,
      accentBg: 'bg-amber-100',
      accentIcon: 'text-amber-600',
      href: '/automatizaciones/carrito-abandonado',
      badges: ['Gratis', 'Básica'],
    },
    {
      id: 'leads-a-sheets',
      name: 'Leads → Google Sheets',
      description:
        'Añade una fila en Google Sheets cuando llegue un nuevo lead.',
      icon: FileSpreadsheet,
      accentBg: 'bg-emerald-100',
      accentIcon: 'text-emerald-600',
      href: '/automatizaciones/leads-a-sheets',
      badges: ['Gratis', 'Básica'],
    },
    {
      id: 'pago-fallido',
      name: 'Alerta de pago fallido',
      description:
        'Notifica por email cuando falle un cobro para actuar de inmediato.',
      icon: Bell,
      accentBg: 'bg-sky-100',
      accentIcon: 'text-sky-600',
      href: '/automatizaciones/pago-fallido',
      badges: ['Gratis', 'Básica'],
    },
    {
      id: 'post-a-redes',
      name: 'Post → Redes sociales',
      description:
        'Publica en redes automáticamente cuando haya una nueva entrada de blog.',
      icon: Megaphone,
      accentBg: 'bg-purple-100',
      accentIcon: 'text-purple-600',
      href: '/automatizaciones/post-a-redes',
      badges: ['Gratis', 'Básica'],
    },
  ]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    )
  }, [query])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Topbar */}
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/50 bg-white/70 border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-black flex items-center justify-center text-[#FAF9F6]">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 leading-none">Bienvenido</p>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 leading-tight">
                {user.email}
              </h1>
            </div>
          </div>

          <a
            href="/ajustes"
            className="inline-flex items-center gap-2 rounded-xl bg-black text-[#FAF9F6] px-3 sm:px-4 py-2 text-sm font-medium shadow hover:opacity-90 transition"
          >
            <Settings className="h-4 w-4" />
            Ajustes
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base sm:text-lg">Plan actual</h2>
              <CreditCard className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-gray-600 mt-2">Gratis</p>
            <a
              href="/suscripcion"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-black text-[#FAF9F6] px-3 py-2 text-sm hover:opacity-90"
            >
              Ver planes
            </a>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base sm:text-lg">Automatizaciones activas</h2>
              <Workflow className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-gray-600 mt-2">0</p>
            <a
              href="/automatizaciones"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-black text-[#FAF9F6] px-3 py-2 text-sm hover:opacity-90"
            >
              Configurar
            </a>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base sm:text-lg">Último acceso</h2>
              <BarChart className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-gray-600 mt-2">
              {new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base sm:text-lg">Créditos</h2>
              <CreditCard className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-gray-600 mt-2">100</p>
            <a
              href="/suscripcion"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-black text-[#FAF9F6] px-3 py-2 text-sm hover:opacity-90"
            >
              Añadir
            </a>
          </div>
        </section>

        {/* Marketplace header */}
        <section className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                Marketplace de Automatizaciones
              </h2>
              <p className="text-gray-600 mt-1">
                Plantillas básicas para empezar en minutos.
              </p>
            </div>

            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar plantillas..."
                className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-0 focus:border-gray-300 focus:ring-2 focus:ring-black/10"
              />
            </div>
          </div>
        </section>

        {/* Marketplace grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filtered.map((t) => (
            <article
              key={t.id}
              className="group bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition flex flex-col"
            >
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-11 h-11 rounded-xl ${t.accentBg} flex items-center justify-center`}>
                  <t.icon className={`h-5 w-5 ${t.accentIcon}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                    {t.name}
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">{t.description}</p>
                </div>
              </div>

              {t.badges && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {t.badges.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs text-gray-700"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between">
                <a
                  href={t.href}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-black text-[#FAF9F6] px-4 py-2.5 text-sm font-medium shadow hover:opacity-90 transition"
                >
                  <Zap className="h-4 w-4" /> Instalar
                </a>
                <a
                  href={t.href}
                  className="text-sm text-gray-700 underline-offset-4 hover:underline"
                >
                  Ver detalles
                </a>
              </div>
            </article>
          ))}

          {/* Empty state when no results */}
          {filtered.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl p-8 border text-center">
              <p className="text-gray-600">
                No se encontraron plantillas para "{query}".
              </p>
            </div>
          )}
        </section>

        {/* Quick nav */}
        <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Suscripción */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <h2 className="font-semibold text-base sm:text-lg text-gray-900">Suscripción</h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base mb-4">
                Gestiona tu plan actual y cambia de suscripción cuando quieras.
              </p>
            </div>
            <a
              href="/suscripcion"
              className="mt-auto inline-block bg-black text-[#FAF9F6] px-4 py-2 rounded-lg text-sm sm:text-base hover:opacity-90 transition"
            >
              Ver planes
            </a>
          </div>

          {/* Automatizaciones */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Workflow className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <h2 className="font-semibold text-base sm:text-lg text-gray-900">Automatizaciones</h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base mb-4">
                Activa y configura las automatizaciones que necesites en tu negocio.
              </p>
            </div>
            <a
              href="/automatizaciones"
              className="mt-auto inline-block bg-black text-[#FAF9F6] px-4 py-2 rounded-lg text-sm sm:text-base hover:opacity-90 transition"
            >
              Configurar
            </a>
          </div>

          {/* Reportes */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <BarChart className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                </div>
                <h2 className="font-semibold text-base sm:text-lg text-gray-900">Reportes</h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base mb-4">
                Accede a reportes automáticos de tu actividad y métricas clave.
              </p>
            </div>
            <a
              href="#"
              className="mt-auto inline-block bg-black text-[#FAF9F6] px-4 py-2 rounded-lg text-sm sm:text-base hover:opacity-90 transition"
            >
              Ver reportes
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t bg-white/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
          <p>© {new Date().getFullYear()} Tu Empresa</p>
          <div className="flex items-center gap-4">
            <a href="/privacidad" className="hover:underline">
              Privacidad
            </a>
            <a href="/terminos" className="hover:underline">
              Términos
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
