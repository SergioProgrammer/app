'use client'

import {
  ArrowDown,
  ArrowUp,
  Check,
  Clipboard,
  Copy,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import type { SaveStatus } from '../types'

interface SpreadsheetToolbarProps {
  saveStatus: SaveStatus
  selectedCount: number
  onSave: () => void
  onAddRow: () => void
  onDeleteRows: () => void
  onCopyRows: () => void
  onPasteRows: () => void
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
  onSave,
  onAddRow,
  onDeleteRows,
  onCopyRows,
  onPasteRows,
  onMoveUp,
  onMoveDown,
}: SpreadsheetToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      <button
        onClick={onSave}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
      >
        <Save className="h-3.5 w-3.5" />
        Guardar
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

      <div className="h-4 w-px bg-gray-200" />

      <button
        onClick={onCopyRows}
        disabled={selectedCount === 0}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </button>

      <button
        onClick={onPasteRows}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        <Clipboard className="h-3.5 w-3.5" />
        Pegar
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

      <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
        {saveStatus === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {saveStatus === 'saved' && <Check className="h-3.5 w-3.5 text-emerald-500" />}
        <span>{STATUS_LABEL[saveStatus]}</span>
      </div>
    </div>
  )
}
