'use client'

import { ReactNode, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { LayoutDashboard, CreditCard, Workflow, Settings, LogOut } from 'lucide-react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
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
    <div className="min-h-screen flex bg-[#f9f8f6] text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm flex flex-col justify-between">
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

      {/* Contenido principal */}
      <main className="flex-1 p-10">{children}</main>
    </div>
  )
}
