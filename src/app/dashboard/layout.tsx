'use client'

import { ReactNode, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import {
  LayoutDashboard,
  CreditCard,
  Workflow,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6]">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9f8f6] text-gray-900">
      {/* Sidebar fija (desktop) */}
      <aside className="hidden md:flex fixed top-0 left-0 w-64 h-screen bg-white border-r shadow-sm flex-col justify-between z-40">
        <div className="p-6 space-y-6">
          <h2 className="text-xl font-bold">Mi Panel</h2>
          <nav className="space-y-2">
            <a href="/dashboard" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
              <LayoutDashboard className="w-5 h-5" /> Inicio
            </a>
            <a href="/suscripcion" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
              <CreditCard className="w-5 h-5" /> Suscripción
            </a>
            <a href="/automatizaciones" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
              <Workflow className="w-5 h-5" /> Automatizaciones
            </a>
            <a href="/ajustes" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
              <Settings className="w-5 h-5" /> Ajustes
            </a>
          </nav>
        </div>
        <div className="p-6 border-t">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="flex items-center gap-2 w-full bg-red-500 text-white p-2 rounded-lg hover:bg-red-600"
          >
            <LogOut className="w-5 h-5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Overlay + Sidebar móvil */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setIsOpen(false)}
      />
      <aside
        className={`fixed top-0 left-0 w-64 h-full bg-white shadow-lg z-50 transform transition-transform md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">Mi Panel</h2>
          <button onClick={() => setIsOpen(false)}>
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        <div className="p-6 space-y-2">
          <a href="/dashboard" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
            <LayoutDashboard className="w-5 h-5" /> Inicio
          </a>
          <a href="/suscripcion" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
            <CreditCard className="w-5 h-5" /> Suscripción
          </a>
          <a href="/automatizaciones" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
            <Workflow className="w-5 h-5" /> Automatizaciones
          </a>
          <a href="/ajustes" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
            <Settings className="w-5 h-5" /> Ajustes
          </a>
        </div>
        <div className="p-6 border-t">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="flex items-center gap-2 w-full bg-red-500 text-white p-2 rounded-lg hover:bg-red-600"
          >
            <LogOut className="w-5 h-5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal (con margen para sidebar en desktop) */}
      <main className="md:ml-64 p-4 sm:p-6 lg:p-10">
        {/* Topbar (mobile) */}
        <div className="md:hidden flex items-center justify-between mb-6">
          <button onClick={() => setIsOpen(true)}>
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <span className="text-sm text-gray-600 truncate max-w-[200px]">
            {user.email}
          </span>
        </div>

        {children}
      </main>
    </div>
  )
}
