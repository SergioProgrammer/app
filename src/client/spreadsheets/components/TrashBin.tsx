'use client'

import { Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSpreadsheetList } from '../hooks/useSpreadsheetList'

export function TrashBin() {
  const { spreadsheets, loading, error, restore, remove } = useSpreadsheetList({ mode: 'trash' })
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id)
      setConfirmId(null)
    },
    [remove],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (spreadsheets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
        <p className="text-sm text-gray-500">La papelera está vacía.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {spreadsheets.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{s.name}</p>
            <p className="text-xs text-gray-500">
              {s.rowCount} {s.rowCount === 1 ? 'fila' : 'filas'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => restore(s.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar
            </button>
            {confirmId === s.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDelete(s.id)}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmId(s.id)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
