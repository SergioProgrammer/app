'use client'

import { AlertCircle } from 'lucide-react'
import type { HeaderDataClient } from '../types'

interface SpreadsheetHeaderFieldsProps {
  data: HeaderDataClient
  onChange: (data: Partial<HeaderDataClient>) => void
}

interface FieldDef {
  key: keyof HeaderDataClient
  label: string
  type?: 'date'
}

const HEADER_FIELDS: FieldDef[] = [
  { key: 'invoiceNumber', label: 'Nº factura' },
  { key: 'invoiceDate', label: 'Fecha', type: 'date' },
  { key: 'destination', label: 'Destino' },
  { key: 'awb', label: 'AWB' },
  { key: 'flightNumber', label: 'Nº de vuelo' },
  { key: 'incoterm', label: 'Incoterm' },
]

export function SpreadsheetHeaderFields({ data, onChange }: SpreadsheetHeaderFieldsProps) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 px-4 pb-4 pt-3">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Datos de cabecera</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HEADER_FIELDS.map((field) => {
          const isEmpty = !(data[field.key] ?? '').trim()
          return (
            <div key={field.key}>
              <label className="text-sm text-gray-700">
                {field.label}
                <input
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={data[field.key]}
                  onChange={(e) => onChange({ [field.key]: e.target.value })}
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${
                    isEmpty
                      ? 'border-red-400 outline outline-2 outline-red-400 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                />
              </label>
              {isEmpty && (
                <span className="mt-1 flex items-center gap-1 text-xs text-red-700 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  Campo requerido
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
