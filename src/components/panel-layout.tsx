'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import {
  LayoutDashboard,
  CreditCard,
  Workflow,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'

interface PanelLayoutProps {
  children: ReactNode
}

const navItems = [
  {
    label: 'Inicio',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Suscripción',
    href: '/suscripcion',
    icon: CreditCard,
  },
  {
    label: 'Automatizaciones',
    href: '/automatizaciones',
    icon: Workflow,
  },
  {
    label: 'Ajustes',
    href: '/ajustes',
    icon: Settings,
  },
]

export default function PanelLayout({ children }: PanelLayoutProps) {
  const supabase = createClient()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isOpen, setIsOpen] = useState(false)

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

  const containerClass = useMemo(() => {
    if (pathname === '/dashboard') {
      return 'mx-auto w-full max-w-7xl'
    }
    return 'mx-auto w-full max-w-5xl'
  }, [pathname])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6]">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  function isActive(href: string) {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-[#f9f8f6] text-gray-900">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed top-0 left-0 w-72 h-screen bg-white border-r shadow-[0_10px_30px_-12px_rgba(15,23,42,0.2)] flex-col z-40">
        <div className="px-6 pt-8 pb-6 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white rounded-br-3xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center font-semibold text-white">
              N
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Panel</p>
              <p className="text-base font-semibold">ProcesIA Integraciones</p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-medium">{user.email}</p>
            <p className="mt-1 text-xs text-white/70">Plan Growth activo</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition shadow-sm ${
                  active
                    ? 'bg-gray-900 text-white shadow-gray-900/20'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition ${
                      active
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-600 group-hover:border-gray-300 group-hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </span>
                <ChevronRight
                  className={`h-4 w-4 transition ${active ? 'opacity-80' : 'opacity-0 group-hover:opacity-50'}`}
                />
              </Link>
            )
          })}
        </div>

        <div className="px-6 pb-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">¿Necesitas ayuda?</p>
            <p className="mt-1 text-xs text-gray-600">
              Nuestro equipo puede acompañarte en la configuración de nuevas automatizaciones.
            </p>
            <a
              href="mailto:info@saraquintana.es"
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold hover:opacity-90 transition"
            >
              Escribir al soporte
            </a>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 w-72 h-full bg-white shadow-2xl z-50 transform transition-transform md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
              N
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Nora Automations</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)}>
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-72 min-h-screen overflow-x-hidden">
        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-10">
          {/* Mobile topbar */}
          <div className="md:hidden flex items-center justify-between mb-6">
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-600 truncate max-w-[60%] text-right">
              {user.email}
            </span>
          </div>

          <div className={containerClass}>{children}</div>
        </div>
      </main>
    </div>
  )
}
