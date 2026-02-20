'use client'

import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
  autoDismiss = true,
  autoDismissDelay = 5000,
}: ToastProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const toastRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(onDismiss, autoDismissDelay)
      return () => clearTimeout(timer)
    }
  }, [autoDismiss, autoDismissDelay, onDismiss])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'A' || (e.target as HTMLElement).tagName === 'BUTTON') {
      return
    }
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart])

  const bgColor = type === 'success' ? 'bg-emerald-50' : 'bg-red-50'
  const borderColor = type === 'success' ? 'border-emerald-200' : 'border-red-200'
  const textColor = type === 'success' ? 'text-emerald-800' : 'text-red-800'
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div
      ref={toastRef}
      className="fixed top-4 right-4 z-50 w-96 animate-in fade-in slide-in-from-right-2 duration-300"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      <div className={`flex items-start gap-2 rounded-lg border ${borderColor} ${bgColor} px-3 py-2.5 ${textColor} shadow-lg`}>
        <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1 min-w-0">
          <div className="font-semibold text-xs">{title}</div>
          {message && <div className="text-xs opacity-90 line-clamp-2">{message}</div>}
          {links && links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold underline hover:opacity-80 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="cursor-pointer text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
