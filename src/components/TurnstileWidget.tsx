'use client'
import { useEffect, useRef } from 'react'

type Props = {
  onVerify: (token: string) => void
}

export default function TurnstileWidget({ onVerify }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
          callback: (token: string) => {
            console.log('✅ Token recibido en callback:', token)
            onVerify(token)
          },
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [onVerify])

  return <div ref={containerRef}></div>
}
