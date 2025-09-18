'use client'

import { useEffect, useRef } from 'react'

export default function TurnstileWidget() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Cargar el script de Cloudflare
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile && containerRef.current) {
        window.turnstile.render(containerRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
          theme: 'light',
          action: 'submit',
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return <div ref={containerRef}></div>
}
