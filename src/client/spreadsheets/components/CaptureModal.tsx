'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { SPREADSHEET_COLUMNS } from '../types'

interface CaptureModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (selectedColumns: string[]) => void
}

export function CaptureModal({ open, onClose, onConfirm }: CaptureModalProps) {
  const allKeys = SPREADSHEET_COLUMNS.map((c) => c.key)
  const [selected, setSelected] = useState<Set<string>>(new Set(allKeys))

  if (!open) return null

  const allSelected = selected.size === allKeys.length

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allKeys))
  }

  const toggleColumn = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleConfirm = () => {
    const ordered = allKeys.filter((k) => selected.has(k))
    onConfirm(ordered)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Seleccionar columnas para la captura</h2>
          <button onClick={onClose} className="cursor-pointer text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 border-b border-gray-100 pb-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-gray-300"
            />
            Seleccionar todas
          </label>

          {SPREADSHEET_COLUMNS.map((col) => (
            <label key={col.key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={selected.has(col.key)}
                onChange={() => toggleColumn(col.key)}
                className="rounded border-gray-300"
              />
              {col.label}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="cursor-pointer rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            Capturar
          </button>
        </div>
      </div>
    </div>
  )
}
