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
}

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Facturación',
    fields: [
      { key: 'invoiceNumber', label: 'Número de factura' },
      { key: 'invoiceDate', label: 'Fecha' },
    ],
  },
  {
    title: 'Cliente',
    fields: [
      { key: 'clientName', label: 'Nombre', colSpan: 2 },
      { key: 'clientTaxId', label: 'CIF/NIF' },
      { key: 'clientAddress', label: 'Dirección', colSpan: 2 },
    ],
  },
  {
    title: 'Emisor',
    fields: [
      { key: 'emitterName', label: 'Nombre', colSpan: 2 },
      { key: 'emitterTaxId', label: 'CIF/NIF' },
      { key: 'emitterAddress', label: 'Dirección', colSpan: 2 },
    ],
  },
  {
    title: 'Envío',
    fields: [
      { key: 'destination', label: 'Destino' },
      { key: 'incoterm', label: 'Incoterm' },
      { key: 'awb', label: 'AWB' },
      { key: 'flightNumber', label: 'Nº vuelo' },
    ],
  },
  {
    title: 'Pago y banco',
    fields: [
      { key: 'paymentTerms', label: 'Condiciones de pago', colSpan: 2 },
      { key: 'bankName', label: 'Banco', colSpan: 2 },
      { key: 'bankIban', label: 'IBAN' },
      { key: 'bankSwift', label: 'SWIFT' },
    ],
  },
  {
    title: 'Producto',
    fields: [
      { key: 'productForm', label: 'Forma del producto' },
      { key: 'botanicalName', label: 'Nombre botánico' },
    ],
  },
]

export function SpreadsheetHeaderForm({ data, onChange }: SpreadsheetHeaderFormProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <h2 className="text-sm font-semibold text-gray-900">Datos de cabecera</h2>
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-3">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                {section.title}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <label
                    key={field.key}
                    className={`text-sm text-gray-700 ${field.colSpan === 2 ? 'sm:col-span-2' : ''}`}
                  >
                    {field.label}
                    <input
                      type={field.key === 'invoiceDate' ? 'date' : 'text'}
                      value={data[field.key]}
                      onChange={(e) => onChange({ [field.key]: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
