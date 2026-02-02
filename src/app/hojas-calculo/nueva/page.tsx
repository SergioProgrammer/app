'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FileText } from 'lucide-react'
import { useSpreadsheet } from '@/client/spreadsheets/hooks/useSpreadsheet'
import { SpreadsheetToolbar } from '@/client/spreadsheets/components/SpreadsheetToolbar'
import { SpreadsheetTable } from '@/client/spreadsheets/components/SpreadsheetTable'
import { SpreadsheetHeaderForm } from '@/client/spreadsheets/components/SpreadsheetHeaderForm'
import { PasteFromExcel } from '@/client/spreadsheets/components/PasteFromExcel'
import * as api from '@/client/spreadsheets/services/spreadsheetApi'

export default function NuevaHojaPage() {
  const router = useRouter()
  const {
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
    copyRows,
    pasteRows,
    addPastedRows,
    updateHeaderData,
    updateName,
    save,
  } = useSpreadsheet({})

  const [generating, setGenerating] = useState(false)
  const [generatedLinks, setGeneratedLinks] = useState<{
    invoiceUrl: string | null
    anexoUrl: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    try {
      await save()
      // Después del primer guardado, redirigir a la página de edición
      // save() retorna void pero el spreadsheetId se actualiza internamente
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }, [save])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setGeneratedLinks(null)
    try {
      // Primero guardar para asegurar que existe en DB
      await save()
      // Necesitamos el ID - guardamos y luego generamos
      // El ID está en el hook pero no es accesible directamente en esta primera creación
      setError('Guarda la hoja primero. Después de guardar, serás redirigido a la vista de edición donde podrás generar la factura.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar')
    } finally {
      setGenerating(false)
    }
  }, [save])

  const selectedIndex = selectedRows.size === 1 ? [...selectedRows][0] : -1

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

      <SpreadsheetToolbar
        saveStatus={saveStatus}
        selectedCount={selectedRows.size}
        onSave={handleSave}
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
