'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  LayoutDashboard,
  CreditCard,
  Workflow,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react'

export default function AutomatizacionPage() {
  const supabase = createClient()
  const params = useParams()
  const automationId = params.id as string

  const [tone, setTone] = useState('')
  const [goal, setGoal] = useState('')
  const [restrictions, setRestrictions] = useState('')
  const [signature, setSignature] = useState('')
  const [example, setExample] = useState('')
  const [pricingPolicy, setPricingPolicy] = useState('')
  const [prices, setPrices] = useState('')
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    async function loadPrompt() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data } = await supabase
        .from('user_automations')
        .select('prompt')
        .eq('user_id', user.id)
        .eq('automation_id', automationId)
        .single()

      if (data?.prompt) {
        // Guardamos el prompt como texto plano (Opción B)
        // Solo mostramos en textarea si quisieras que se edite entero
      }

      setLoading(false)
    }
    loadPrompt()
  }, [supabase, automationId])

  async function savePrompt() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    // Generar prompt final
    const finalPrompt = `
Responde a los correos siguiendo estas instrucciones:

- Tono: ${tone || 'No especificado'}
- Objetivo: ${goal || 'No especificado'}
- Restricciones: ${restrictions || 'Ninguna'}
- Política de precios: ${pricingPolicy || 'No especificada'}
${(pricingPolicy === 'rango' || pricingPolicy === 'exactos') ? `- Precios: ${prices || 'No definidos'}` : ''}
- Firma: ${signature || 'No definida'}
- Ejemplo de respuesta ideal: ${example || 'Ninguno'}
    `.trim()

    // Guardar en Supabase
    await supabase.from('user_automations').upsert({
      user_id: user.id,
      automation_id: automationId,
      prompt: finalPrompt,
    })

    // Enviar al backend
    await fetch('https://n8n.sqstudio.es/webhook/user-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        automationId,
        userPrompt: finalPrompt,
      }),
    })

    alert('✅ Configuración guardada correctamente')
  }

  if (loading) return <p className="p-6">Cargando...</p>

  return (
    <div className="min-h-screen flex bg-[#f9f8f6] text-gray-900">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 bg-white border-r shadow-sm flex-col justify-between">
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

      {/* Botón menú móvil */}
      <button
        className="absolute top-4 left-4 md:hidden p-2 bg-white border rounded shadow"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Sidebar móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 md:hidden">
          <aside className="w-64 bg-white h-full shadow-md p-6 space-y-4">
            <button
              className="mb-4 text-red-500"
              onClick={() => setSidebarOpen(false)}
            >
              Cerrar ✖
            </button>
            <nav className="space-y-2">
              <a href="/dashboard" className="block p-2 rounded hover:bg-gray-100">Inicio</a>
              <a href="/suscripcion" className="block p-2 rounded hover:bg-gray-100">Suscripción</a>
              <a href="/automatizaciones" className="block p-2 rounded hover:bg-gray-100">Automatizaciones</a>
              <a href="/ajustes" className="block p-2 rounded hover:bg-gray-100">Ajustes</a>
            </nav>
          </aside>
        </div>
      )}

      {/* Contenido principal */}
      <main className="flex-1 p-10">
        <h1 className="text-2xl font-bold mb-6">Configura tu automatización</h1>

        <div className="max-w-lg space-y-4">
          <label className="block font-semibold">Tono de la respuesta</label>
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Ejemplo: Formal, cercano, profesional..."
            className="w-full border rounded p-3"
          />

          <label className="block font-semibold">Objetivo principal</label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ejemplo: Ofrecer cita, resolver dudas..."
            className="w-full border rounded p-3"
          />

          <label className="block font-semibold">Restricciones</label>
          <textarea
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            placeholder="Ejemplo: No hablar de precios, máximo 3 párrafos..."
            className="w-full border rounded p-3"
          />

          <label className="block font-semibold">Política de precios</label>
          <select
            value={pricingPolicy}
            onChange={(e) => setPricingPolicy(e.target.value)}
            className="w-full border rounded p-3"
          >
            <option value="">Selecciona una opción...</option>
            <option value="no-precios">No dar precios</option>
            <option value="rango">Dar un rango orientativo</option>
            <option value="exactos">Dar precios exactos</option>
            <option value="presupuesto">Invitar a pedir un presupuesto</option>
          </select>

          {(pricingPolicy === 'rango' || pricingPolicy === 'exactos') && (
            <>
              <label className="block font-semibold">Introduce aquí los precios</label>
              <textarea
                value={prices}
                onChange={(e) => setPrices(e.target.value)}
                placeholder="Ejemplo: Limpieza dental 40-60€, Ortodoncia desde 1800€..."
                className="w-full border rounded p-3"
              />
            </>
          )}

          <label className="block font-semibold">Firma o identidad</label>
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Ejemplo: Clínica Dental Smile, Dr. Pérez..."
            className="w-full border rounded p-3"
          />

          <label className="block font-semibold">Ejemplo de respuesta ideal</label>
          <textarea
            value={example}
            onChange={(e) => setExample(e.target.value)}
            placeholder="Escribe aquí un ejemplo de cómo te gustaría que respondiera la IA"
            className="w-full border rounded p-3"
          />

          <button
            onClick={savePrompt}
            className="bg-black text-white px-4 py-2 rounded w-full mt-6"
          >
            Guardar configuración
          </button>
        </div>
      </main>
    </div>
  )
}
