'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { CreditCard, Workflow, Settings, BarChart } from 'lucide-react'

export default function DashboardPage() {
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
    <div className="min-h-screen bg-[#f9f8f6] p-10">
      <h1 className="text-3xl font-bold mb-8">
        Bienvenido, <span className="text-gray-800">{user.email}</span>
      </h1>

      {/* Grid de KPIs básicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-2xl p-6 shadow-md border hover:shadow-lg transition">
          <h2 className="font-semibold text-lg mb-2">Plan actual</h2>
          <p className="text-gray-600">Gratis</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-md border hover:shadow-lg transition">
          <h2 className="font-semibold text-lg mb-2">Automatizaciones activas</h2>
          <p className="text-gray-600">0</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-md border hover:shadow-lg transition">
          <h2 className="font-semibold text-lg mb-2">Último acceso</h2>
          <p className="text-gray-600">{new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* Grid de navegación */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Suscripción */}
        <div className="bg-white rounded-2xl p-6 shadow-md border hover:shadow-lg transition">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="font-semibold text-lg text-gray-900">Suscripción</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Gestiona tu plan actual y cambia de suscripción cuando quieras.
          </p>
          <a
            href="/suscripcion"
            className="inline-block bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black transition"
          >
            Ver planes
          </a>
        </div>

        {/* Automatizaciones */}
        <div className="bg-white rounded-2xl p-6 shadow-md border hover:shadow-lg transition">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Workflow className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="font-semibold text-lg text-gray-900">Automatizaciones</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Activa y configura las automatizaciones que necesites en tu negocio.
          </p>
          <a
            href="/automatizaciones"
            className="inline-block bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black transition"
          >
            Configurar
          </a>
        </div>

        {/* Ajustes */}
        <div className="bg-white rounded-2xl p-6 shadow-md border hover:shadow-lg transition">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="font-semibold text-lg text-gray-900">Ajustes</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Cambia tu contraseña, gestiona tu perfil o cierra sesión en cualquier momento.
          </p>
          <a
            href="/ajustes"
            className="inline-block bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black transition"
          >
            Abrir ajustes
          </a>
        </div>

        {/* Reportes */}
        <div className="bg-white rounded-2xl p-6 shadow-md border hover:shadow-lg transition">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <BarChart className="w-6 h-6 text-yellow-600" />
            </div>
            <h2 className="font-semibold text-lg text-gray-900">Reportes</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Accede a reportes automáticos de tu actividad y métricas clave.
          </p>
          <a
            href="#"
            className="inline-block bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black transition"
          >
            Ver reportes
          </a>
        </div>
      </div>
    </div>
  )
}
