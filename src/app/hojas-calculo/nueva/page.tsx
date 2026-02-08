'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Pencil, Save } from 'lucide-react'
import Link from 'next/link'
import { useSpreadsheet } from '@/client/spreadsheets/hooks/useSpreadsheet'
import { SpreadsheetToolbar } from '@/client/spreadsheets/components/SpreadsheetToolbar'
import { SpreadsheetTable } from '@/client/spreadsheets/components/SpreadsheetTable'
import { SpreadsheetHeaderForm } from '@/client/spreadsheets/components/SpreadsheetHeaderForm'
import { PasteFromExcel } from '@/client/spreadsheets/components/PasteFromExcel'
import { REQUIRED_ROW_FIELDS } from '@/client/spreadsheets/types'

export default function NuevaHojaPage() {
  const router = useRouter()
  const {
    spreadsheetId,
    name,
    headerData,
    rows,
    saveStatus,
    selectedRows,
    setSelectedRows,
    updateRow,
    addRow,
    deleteRows,
    moveRow,
    duplicateRows,
    addPastedRows,
    updateHeaderData,
    updateName,
    save,
  } = useSpreadsheet({})

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [headerReviewed, setHeaderReviewed] = useState(false)

  useEffect(() => {
    if (spreadsheetId) {
      router.replace(`/hojas-calculo/${spreadsheetId}`)
    }
  }, [spreadsheetId, router])

  const handleSave = useCallback(async () => {
    try {
      await save()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }, [save])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      // Validar cabecera
      const missingHeaders = (Object.keys(headerData) as (keyof typeof headerData)[])
        .filter((k) => !headerData[k].trim())
      if (missingHeaders.length > 0) {
        setError('Rellena todos los datos de cabecera antes de generar la factura.')
        return
      }

      // Validar que haya filas con datos
      const dataRows = rows.filter((r) => {
        const { id: _id, position: _pos, ...fields } = r
        return Object.values(fields).some((v) => v !== '')
      })
      if (dataRows.length === 0) {
        setError('Añade al menos una fila con datos antes de generar la factura.')
        return
      }

      // Validar campos requeridos en cada fila con datos
      const incomplete = dataRows.some((r) =>
        REQUIRED_ROW_FIELDS.some((key) => !String(r[key] ?? '').trim()),
      )
      if (incomplete) {
        setError('Cada fila debe tener al menos: Producto, Kg y Precio.')
        return
      }

      await save()
      // After save, spreadsheetId will be set → useEffect redirects to edit page
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar')
    } finally {
      setGenerating(false)
    }
  }, [save, headerData, rows])

  const selectedIndex = selectedRows.size === 1 ? [...selectedRows][0] : -1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/hojas-calculo"
            className="mb-1 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a hojas de cálculo
          </Link>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => updateName(e.target.value)}
              className="text-2xl font-semibold text-gray-900 bg-transparent border-b border-dashed border-gray-300 outline-none focus:border-gray-900 py-0.5 px-1 transition-colors"
              placeholder="Nombre de la hoja"
            />
            <Pencil className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      <SpreadsheetToolbar
        saveStatus={saveStatus}
        selectedCount={selectedRows.size}
        onSave={handleSave}
        onAddRow={addRow}
        onDeleteRows={() => deleteRows(selectedRows)}
        onDuplicate={() => duplicateRows(selectedRows)}
        onMoveUp={() => selectedIndex >= 0 && moveRow(selectedIndex, 'up')}
        onMoveDown={() => selectedIndex >= 0 && moveRow(selectedIndex, 'down')}
      />

      <PasteFromExcel onPaste={addPastedRows} />

      <SpreadsheetTable
        rows={rows}
        selectedRows={selectedRows}
        onSelectRows={setSelectedRows}
        onUpdateRow={updateRow}
        onAddRow={addRow}
      />

      <SpreadsheetHeaderForm data={headerData} onChange={updateHeaderData} />

      <div className="flex flex-col items-end gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={headerReviewed}
            onChange={(e) => setHeaderReviewed(e.target.checked)}
            className="cursor-pointer rounded border-gray-300"
          />
          He revisado la sección Datos de cabecera
        </label>
        <button
          onClick={handleGenerate}
          disabled={generating || !headerReviewed}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar y continuar
        </button>
      </div>
    </div>
  )
}
