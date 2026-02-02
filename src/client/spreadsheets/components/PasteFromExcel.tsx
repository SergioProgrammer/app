'use client'

import { ChevronDown, ChevronRight, ClipboardPaste } from 'lucide-react'
import { useCallback, useState } from 'react'
import { parseExcelPaste } from '@/lib/parseExcelPaste'
import type { SpreadsheetRowClient } from '../types'
import { SPREADSHEET_COLUMNS } from '../types'

interface PasteFromExcelProps {
  onPaste: (rows: Omit<SpreadsheetRowClient, 'id' | 'position'>[]) => void
}

// Mapeo de campos parseados a columnas de la tabla
function mapParsedRow(
  parsed: Record<string, unknown>,
): Omit<SpreadsheetRowClient, 'id' | 'position'> {
  return {
    week: '',
    invoiceDate: '',
    date: '',
    finalClient: '',
    kg: parsed.netWeightKg != null ? String(parsed.netWeightKg) : '',
    product: (parsed.product as string) ?? '',
    boxType: '',
    bundles: parsed.bundles != null ? String(parsed.bundles) : '',
    price: parsed.price != null ? String(parsed.price) : '',
    orderNumber: '',
    awb: (parsed.awb as string) ?? '',
    deliveryNote: '',
    invoiceNumber: (parsed.invoiceNumber as string) ?? '',
    line: '',
    search: '',
  }
}

export function PasteFromExcel({ onPaste }: PasteFromExcelProps) {
  const [open, setOpen] = useState(false)
  const [rawText, setRawText] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  const handleProcess = useCallback(() => {
    setWarnings([])
    const result = parseExcelPaste(rawText)
    if (result.rows.length === 0) {
      setWarnings(result.warnings.length > 0 ? result.warnings : ['No se encontraron filas.'])
      return
    }
    setWarnings(result.warnings)
    onPaste(result.rows.map((row) => mapParsedRow(row as unknown as Record<string, unknown>)))
    setRawText('')
  }, [rawText, onPaste])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Pegar desde Excel</h2>
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
        <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
          <p className="text-xs text-gray-500">
            Copia filas desde Excel y pégalas aquí. Columnas reconocidas:{' '}
            {SPREADSHEET_COLUMNS.filter((c) =>
              ['product', 'kg', 'price', 'bundles', 'invoiceNumber', 'awb'].includes(c.key),
            )
              .map((c) => c.label)
              .join(', ')}
            .
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Pega aquí los datos copiados desde Excel..."
            rows={5}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
          />
          {warnings.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-amber-700 space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <button
            onClick={handleProcess}
            disabled={!rawText.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            <ClipboardPaste className="h-4 w-4" />
            Procesar pegado
          </button>
        </div>
      )}
    </div>
  )
}
