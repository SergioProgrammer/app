'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getPanelSlugForUser } from '@/lib/panel-config'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function redirectToPanel() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const slug = getPanelSlugForUser(session.user)
      router.replace(`/panel/${slug}`)
    }

    redirectToPanel()
  }, [supabase, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
      <p className="text-gray-500">Cargando panel personalizado...</p>
    </div>
  )
}

