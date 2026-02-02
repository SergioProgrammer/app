'use client'

import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SaveStatus } from '../types'

interface SpreadsheetToolbarProps {
  saveStatus: SaveStatus
  selectedCount: number
  hasActiveRow: boolean
  onSave: () => void
  onAddRow: () => void
  onDeleteRows: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Guardado',
  saving: 'Guardando...',
  unsaved: 'Cambios sin guardar',
}

export function SpreadsheetToolbar({
  saveStatus,
  selectedCount,
  hasActiveRow,
  onSave,
  onAddRow,
  onDeleteRows,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: SpreadsheetToolbarProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  const isSaving = saveStatus === 'saving'

  useEffect(() => {
    if (!helpOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [helpOpen])

  return (
    <div className="relative flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {isSaving ? 'Guardando...' : 'Guardar'}
      </button>

      <div className="h-4 w-px bg-gray-200" />

      <button
        onClick={onAddRow}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        <Plus className="h-3.5 w-3.5" />
        Fila
      </button>

      <button
        onClick={onDeleteRows}
        disabled={selectedCount === 0}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Eliminar
      </button>

      <button
        onClick={onDuplicate}
        disabled={selectedCount === 0 && !hasActiveRow}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
      >
        <Copy className="h-3.5 w-3.5" />
        Duplicar línea
      </button>

      <div className="h-4 w-px bg-gray-200" />

      <button
        onClick={onMoveUp}
        disabled={selectedCount !== 1}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={onMoveDown}
        disabled={selectedCount !== 1}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>

      <div className="h-4 w-px bg-gray-200" />

      <button
        onClick={() => setHelpOpen(!helpOpen)}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
        {saveStatus === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {saveStatus === 'saved' && <Check className="h-3.5 w-3.5 text-emerald-500" />}
        <span>{STATUS_LABEL[saveStatus]}</span>
      </div>

      {helpOpen && (
        <div
          ref={helpRef}
          className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Ayuda - Botones de edición</h3>
            <button onClick={() => setHelpOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1.5 text-xs text-gray-600">
            <li><strong>Guardar:</strong> Guarda todos los cambios de la hoja.</li>
            <li><strong>Fila:</strong> Añade una nueva fila vacía al final con la fecha de hoy.</li>
            <li><strong>Eliminar:</strong> Elimina las filas seleccionadas (checkbox).</li>
            <li><strong>Duplicar línea:</strong> Duplica las filas seleccionadas (o la fila que estés editando) al final de la tabla.</li>
            <li><strong>Flechas arriba/abajo:</strong> Mueven la fila seleccionada de posición. La selección sigue a la fila.</li>
            <li><strong>Tab:</strong> Navega a la siguiente celda. <strong>Enter:</strong> Baja a la celda inferior.</li>
          </ul>
        </div>
      )}
    </div>
  )
}
