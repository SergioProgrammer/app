'use client'

import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'
import { useSpreadsheet } from '@/client/spreadsheets/hooks/useSpreadsheet'
import { SpreadsheetToolbar } from '@/client/spreadsheets/components/SpreadsheetToolbar'
import { SpreadsheetTable } from '@/client/spreadsheets/components/SpreadsheetTable'
import { SpreadsheetHeaderForm } from '@/client/spreadsheets/components/SpreadsheetHeaderForm'
import { PasteFromExcel } from '@/client/spreadsheets/components/PasteFromExcel'
import * as api from '@/client/spreadsheets/services/spreadsheetApi'

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
    copyRows,
    pasteRows,
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

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setGeneratedLinks(null)
    try {
      await save()
      const result = await api.generateInvoice(id)
      setGeneratedLinks(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar factura')
    } finally {
      setGenerating(false)
    }
  }, [id, save])

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
          <p className="text-sm uppercase text-gray-500">Hojas de cálculo</p>
          <input
            type="text"
            value={name}
            onChange={(e) => updateName(e.target.value)}
            className="text-2xl font-semibold text-gray-900 bg-transparent border-0 outline-none focus:ring-0 p-0"
            placeholder="Nombre de la hoja"
          />
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
        onCopyRows={() => copyRows(selectedRows)}
        onPasteRows={pasteRows}
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

      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={generating}
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
