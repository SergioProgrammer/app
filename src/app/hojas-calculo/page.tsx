'use client'

import { SpreadsheetList } from '@/client/spreadsheets/components/SpreadsheetList'

export default function HojasCalculoPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase text-gray-500">Inventario</p>
        <h1 className="text-2xl font-semibold text-gray-900">Hojas de cálculo</h1>
        <p className="text-sm text-gray-600">
          Organiza el inventario de productos y genera facturas.
        </p>
      </div>
      <SpreadsheetList />
    </div>
  )
}
