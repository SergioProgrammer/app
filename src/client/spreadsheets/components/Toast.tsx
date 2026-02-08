'use client'

import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { useEffect } from 'react'

interface ToastProps {
  type: 'success' | 'error'
  title: string
  message?: string
  links?: { label: string; href: string }[]
  onDismiss: () => void
  autoDismiss?: boolean
  autoDismissDelay?: number
}

export function Toast({
  type,
  title,
  message,
  links,
  onDismiss,
  autoDismiss = false,
  autoDismissDelay = 5000,
}: ToastProps) {
  useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(onDismiss, autoDismissDelay)
      return () => clearTimeout(timer)
    }
  }, [autoDismiss, autoDismissDelay, onDismiss])

  const bgColor = type === 'success' ? 'bg-emerald-50' : 'bg-red-50'
  const borderColor = type === 'success' ? 'border-emerald-200' : 'border-red-200'
  const textColor = type === 'success' ? 'text-emerald-800' : 'text-red-800'
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`flex items-start gap-3 rounded-xl border-2 ${borderColor} ${bgColor} px-4 py-3 ${textColor} shadow-2xl`}>
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <div className="font-semibold text-sm">{title}</div>
          {message && <div className="text-sm">{message}</div>}
          {links && links.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold underline hover:opacity-80 cursor-pointer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="cursor-pointer text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
