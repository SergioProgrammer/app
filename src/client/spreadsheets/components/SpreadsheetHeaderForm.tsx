'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { HeaderDataClient } from '../types'

interface SpreadsheetHeaderFormProps {
  data: HeaderDataClient
  onChange: (data: Partial<HeaderDataClient>) => void
}

interface FieldDef {
  key: keyof HeaderDataClient
  label: string
  colSpan?: 2
  type?: 'date'
}

const HEADER_FIELDS: FieldDef[] = [
  { key: 'invoiceNumber', label: 'Número de factura' },
  { key: 'invoiceDate', label: 'Fecha', type: 'date' },
  { key: 'clientName', label: 'Cliente (nombre)', colSpan: 2 },
  { key: 'clientTaxId', label: 'Cliente CIF/NIF' },
  { key: 'clientAddress', label: 'Cliente dirección', colSpan: 2 },
  { key: 'emitterName', label: 'Emisor (nombre)', colSpan: 2 },
  { key: 'emitterTaxId', label: 'Emisor CIF/NIF' },
  { key: 'emitterAddress', label: 'Emisor dirección', colSpan: 2 },
  { key: 'destination', label: 'Destino' },
  { key: 'awb', label: 'AWB' },
  { key: 'flightNumber', label: 'Nº de vuelo' },
  { key: 'incoterm', label: 'Incoterm' },
  { key: 'paymentTerms', label: 'Payment due', colSpan: 2 },
  { key: 'productForm', label: 'Forma' },
  { key: 'botanicalName', label: 'Nombre botánico' },
  { key: 'bankName', label: 'Banco', colSpan: 2 },
  { key: 'bankIban', label: 'IBAN', colSpan: 2 },
  { key: 'bankSwift', label: 'SWIFT/BIC', colSpan: 2 },
]

export function SpreadsheetHeaderForm({ data, onChange }: SpreadsheetHeaderFormProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Datos de cabecera</h2>
          <span className="text-xs text-gray-400">
            {open ? '(Click para plegar)' : '(Click para desplegar)'}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {HEADER_FIELDS.map((field) => (
              <label
                key={field.key}
                className={`text-sm text-gray-700 ${field.colSpan === 2 ? 'sm:col-span-2' : ''}`}
              >
                {field.label}
                <input
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={data[field.key]}
                  onChange={(e) => onChange({ [field.key]: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
