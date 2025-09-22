'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AutomatizacionPage() {
  const supabase = createClient()
  const params = useParams()
  const automationId = params.id as string

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPrompt() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      // Buscar si ya tiene un prompt guardado
      const { data } = await supabase
        .from('user_automations')
        .select('prompt')
        .eq('user_id', user.id)
        .eq('automation_id', automationId)
        .single()

      if (data) setPrompt(data.prompt)
      setLoading(false)
    }
    loadPrompt()
  }, [supabase, automationId])

  async function savePrompt() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    // 1. Guardar en Supabase
    await supabase
      .from('user_automations')
      .upsert({
        user_id: user.id,
        automation_id: automationId,
        prompt,
      })

    // 2. Mandar también el prompt a n8n
    await fetch('https://n8n.sqstudio.es/webhook/user-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        automationId,
        userPrompt: prompt,
      }),
    })

    alert('✅ Configuración guardada y enviada a n8n')
  }

  if (loading) return <p className="p-6">Cargando...</p>

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Configura tu automatización</h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ejemplo: Responde como clínica dental ofreciendo revisiones gratis"
        className="w-full border rounded p-3 mb-4"
      />
      <button
        onClick={savePrompt}
        className="bg-black text-white px-4 py-2 rounded"
      >
        Guardar
      </button>
    </div>
  )
}
