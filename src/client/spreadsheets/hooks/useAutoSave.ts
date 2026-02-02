import { useCallback, useEffect, useRef, useState } from 'react'
import type { SaveStatus } from '../types'

interface UseAutoSaveOptions {
  onSave: () => Promise<void>
  debounceMs?: number
  enabled?: boolean
}

export function useAutoSave({ onSave, debounceMs = 3000, enabled = true }: UseAutoSaveOptions) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)

  const markUnsaved = useCallback(() => {
    if (!enabled) return
    setStatus('unsaved')

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(async () => {
      if (savingRef.current) return
      savingRef.current = true
      setStatus('saving')
      try {
        await onSave()
        setStatus('saved')
      } catch {
        setStatus('unsaved')
      } finally {
        savingRef.current = false
      }
    }, debounceMs)
  }, [onSave, debounceMs, enabled])

  const forceSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (savingRef.current) return
    savingRef.current = true
    setStatus('saving')
    try {
      await onSave()
      setStatus('saved')
    } catch {
      setStatus('unsaved')
    } finally {
      savingRef.current = false
    }
  }, [onSave])

  // Protección beforeunload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === 'unsaved' || status === 'saving') {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [status])

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { status, markUnsaved, forceSave }
}
