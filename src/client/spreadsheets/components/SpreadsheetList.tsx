'use client'

import { Loader2, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSpreadsheetList } from '../hooks/useSpreadsheetList'
import { SpreadsheetCard } from './SpreadsheetCard'

export function SpreadsheetList() {
  const { spreadsheets, loading, error, archive } = useSpreadsheetList({ mode: 'active' })
  const router = useRouter()

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/hojas-calculo/papelera"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Ver papelera
          </Link>
        </div>
        <Link
          href="/hojas-calculo/nueva"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Crear nueva
        </Link>
      </div>

      {spreadsheets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-500">No hay hojas de cálculo todavía.</p>
          <Link
            href="/hojas-calculo/nueva"
            className="mt-2 inline-block text-sm font-medium text-gray-900 underline"
          >
            Crear la primera
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spreadsheets.map((s) => (
            <SpreadsheetCard
              key={s.id}
              spreadsheet={s}
              onClick={() => router.push(`/hojas-calculo/${s.id}`)}
              onArchive={archive}
            />
          ))}
        </div>
      )}
    </div>
  )
}
