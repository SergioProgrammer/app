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
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadPrompt() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      await supabase
        .from('user_automations')
        .select('prompt')
        .eq('user_id', user.id)
        .eq('automation_id', automationId)
        .single()

      setLoading(false)
    }
    loadPrompt()
  }, [supabase, automationId])

  async function savePrompt() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const promptPrefix = `
    IMPORTANTE:
    - Da una única respuesta lista para enviar al cliente.
    - No generes varias alternativas ni ejemplos.
    - No incluyas notas, explicaciones ni preguntas adicionales.
    - Responde como si fueras directamente la empresa que escribe el correo.
    `.trim()

        const userBlock = `
    Responde a los correos siguiendo estas instrucciones:

    - Tono: ${tone || 'No especificado'}
    - Objetivo: ${goal || 'No especificado'}
    - Restricciones: ${restrictions || 'Ninguna'}
    - Política de precios: ${pricingPolicy || 'No especificada'}
    ${(pricingPolicy === 'rango' || pricingPolicy === 'exactos') ? `- Precios: ${prices || 'No definidos'}` : ''}
    - Firma: ${signature || 'No definida'}
    - Ejemplo de respuesta ideal: ${example || 'Ninguno'}
    `.trim()

    const finalPrompt = `${promptPrefix}\n\n${userBlock}`

    // Guardar prompt en Supabase
    await supabase.from('user_automations').upsert({
      user_id: user.id,
      automation_id: automationId,
      prompt: finalPrompt,
    })

    // Obtener la cuenta Gmail vinculada
    const { data: gmailRow, error: gmailError } = await supabase
      .from('gmail_accounts')
      .select('gmail_address')
      .eq('user_id', user.id)
      .single()

    if (gmailError || !gmailRow?.gmail_address) {
      alert('⚠️ No se encontró una cuenta Gmail vinculada. Conéctala antes de continuar.')
      return
    }

    const gmailAddress = gmailRow.gmail_address

    // Llamar a tu API de creación de workflows en n8n
    await fetch('/api/n8n/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        automationId,
        gmailAddress,
        prompt: finalPrompt,
      }),
    })

    // Enviar notificación a tu correo usando FormSubmit
    await fetch("https://formsubmit.co/ajax/info@saraquintana.es", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        automationId,
        gmailAddress,
        prompt: finalPrompt,
      }),
    })

    // Mostrar mensaje en pantalla
    setSaved(true)
  }

  if (loading) return <p className="p-6">Cargando...</p>

  return (
    <div className="min-h-screen flex bg-[#f9f8f6] text-gray-900">
      {/* Sidebar */}
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

      {/* Main */}
      <main className="flex-1 p-10">
        <h1 className="text-2xl font-bold mb-6">Configura tu automatización</h1>
        <div className="max-w-2xl space-y-8">
  {!saved ? (
    <div className="space-y-6">
      {/* Tono */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tono de la respuesta
        </label>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Ej: Formal, cercano, profesional..."
        />
      </div>

      {/* Objetivo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Objetivo principal
        </label>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Ej: Convencer, resolver dudas, vender..."
        />
      </div>

      {/* Restricciones */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Restricciones
        </label>
        <textarea
          value={restrictions}
          onChange={(e) => setRestrictions(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
          rows={3}
          placeholder="Ej: No usar tecnicismos, no dar descuentos..."
        />
      </div>

      {/* Política de precios */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Política de precios
        </label>
        <select
          value={pricingPolicy}
          onChange={(e) => setPricingPolicy(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Selecciona una opción...</option>
          <option value="no-precios">No dar precios</option>
          <option value="rango">Dar un rango orientativo</option>
          <option value="exactos">Dar precios exactos</option>
          <option value="presupuesto">Invitar a pedir un presupuesto</option>
        </select>
      </div>

      {(pricingPolicy === "rango" || pricingPolicy === "exactos") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Introduce aquí los precios
          </label>
          <textarea
            value={prices}
            onChange={(e) => setPrices(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
            rows={2}
            placeholder="Ej: Entre 100€ y 200€, 150€ exactos..."
          />
        </div>
      )}

      {/* Firma */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Firma o identidad
        </label>
        <input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Ej: Equipo de Ventas, Ana Pérez..."
        />
      </div>

      {/* Conocimiento extra */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Información adicional
        </label>
        <textarea
          value={example}
          onChange={(e) => setExample(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
          rows={3}
          placeholder="Dirección, historia de la empresa, dudas frecuentes..."
        />
      </div>

      {/* Botón Guardar */}
      <div className="pt-4">
        <button
          onClick={savePrompt}
          className="w-full bg-black text-white py-3 px-6 rounded-xl font-semibold text-lg hover:bg-gray-800 transition"
        >
          Guardar configuración
        </button>
      </div>
    </div>
  ) : (
    <div className="text-center mt-6 bg-green-50 border border-green-200 rounded-xl p-6">
      <p className="text-green-700 font-semibold mb-4">
        ¡Listo! Ya tienes la automatización instalada. <br />
        La revisaremos y te avisaremos en menos de 48h.
      </p>
      <a
        href="/dashboard"
        className="inline-block bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition"
      >
        Ir al Dashboard
      </a>
    </div>
  )}
</div>

      </main>
    </div>
  )
}
