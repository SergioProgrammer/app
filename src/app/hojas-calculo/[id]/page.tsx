'use client'

import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, FileText, Loader2, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useSpreadsheet } from '@/client/spreadsheets/hooks/useSpreadsheet'
import { SpreadsheetToolbar } from '@/client/spreadsheets/components/SpreadsheetToolbar'
import { SpreadsheetTable } from '@/client/spreadsheets/components/SpreadsheetTable'
import { SpreadsheetHeaderForm } from '@/client/spreadsheets/components/SpreadsheetHeaderForm'
import { PasteFromExcel } from '@/client/spreadsheets/components/PasteFromExcel'
import * as api from '@/client/spreadsheets/services/spreadsheetApi'
import type { SpreadsheetColumnKey } from '@/client/spreadsheets/types'
import { SPREADSHEET_COLUMNS } from '@/client/spreadsheets/types'

const REQUIRED_ROW_FIELDS: SpreadsheetColumnKey[] = SPREADSHEET_COLUMNS
  .filter((c) => c.key !== 'search')
  .map((c) => c.key)

export default function EditarHojaPage() {
  const { id } = useParams<{ id: string }>()
  const {
    name,
    headerData,
    rows,
    loading,
    error: loadError,
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
  } = useSpreadsheet({ id })

  const [generating, setGenerating] = useState(false)
  const [generatedLinks, setGeneratedLinks] = useState<{
    invoiceUrl: string | null
    anexoUrl: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [headerReviewed, setHeaderReviewed] = useState(false)

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setGeneratedLinks(null)
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
        setError('Todas las filas deben tener todos los campos rellenos (excepto Búsqueda).')
        return
      }

      await save()
      const result = await api.generateInvoice(id)
      setGeneratedLinks(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar factura')
    } finally {
      setGenerating(false)
    }
  }, [id, save, headerData, rows])

  const selectedIndex = selectedRows.size === 1 ? [...selectedRows][0] : -1

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loadError}
      </div>
    )
  }

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

      {(error || generatedLinks) && (
        <div className="space-y-2">
          {error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {error}
            </div>
          )}
          {generatedLinks && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <span>Factura generada.</span>
              {generatedLinks.invoiceUrl && (
                <a href={generatedLinks.invoiceUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Ver factura
                </a>
              )}
              {generatedLinks.anexoUrl && (
                <a href={generatedLinks.anexoUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Ver anexo IV
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <SpreadsheetToolbar
        saveStatus={saveStatus}
        selectedCount={selectedRows.size}
        onSave={save}
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
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={headerReviewed}
            onChange={(e) => setHeaderReviewed(e.target.checked)}
            className="rounded border-gray-300"
          />
          He revisado la sección Datos de cabecera
        </label>
        <button
          onClick={handleGenerate}
          disabled={generating || !headerReviewed}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Generar factura
        </button>
      </div>
    </div>
  )
}
