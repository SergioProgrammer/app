import { useCallback, useEffect, useState } from 'react'
import type { SpreadsheetListItem } from '../types'
import * as api from '../services/spreadsheetApi'

interface UseSpreadsheetListOptions {
  mode: 'active' | 'trash'
}

export function useSpreadsheetList({ mode }: UseSpreadsheetListOptions) {
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = mode === 'trash' ? await api.listTrash() : await api.listSpreadsheets()
      setSpreadsheets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar hojas')
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    fetch()
  }, [fetch])

  const archive = useCallback(
    async (id: string) => {
      await api.archiveSpreadsheet(id)
      await fetch()
    },
    [fetch],
  )

  const restore = useCallback(
    async (id: string) => {
      await api.restoreSpreadsheet(id)
      await fetch()
    },
    [fetch],
  )

  const remove = useCallback(
    async (id: string) => {
      await api.deleteSpreadsheet(id)
      await fetch()
    },
    [fetch],
  )

  return { spreadsheets, loading, error, refresh: fetch, archive, restore, remove }
}
