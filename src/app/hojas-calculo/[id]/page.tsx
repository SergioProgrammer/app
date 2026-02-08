'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, FileText, Loader2, Pencil, X } from 'lucide-react'
import Link from 'next/link'
import { useSpreadsheet } from '@/client/spreadsheets/hooks/useSpreadsheet'
import { SpreadsheetToolbar } from '@/client/spreadsheets/components/SpreadsheetToolbar'
import { SpreadsheetTable } from '@/client/spreadsheets/components/SpreadsheetTable'
import { SpreadsheetHeaderForm } from '@/client/spreadsheets/components/SpreadsheetHeaderForm'
import { PasteFromExcel } from '@/client/spreadsheets/components/PasteFromExcel'
import { Toast } from '@/client/spreadsheets/components/Toast'
import * as api from '@/client/spreadsheets/services/spreadsheetApi'
import { REQUIRED_ROW_FIELDS } from '@/client/spreadsheets/types'

type GenerateState = 'idle' | 'generating' | 'success' | 'error'

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

  const [generateState, setGenerateState] = useState<GenerateState>('idle')
  const [headerReviewed, setHeaderReviewed] = useState(false)
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    title: string
    message?: string
    links?: { label: string; href: string }[]
  } | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    setGenerateState('generating')
    setToast(null)
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    try {
      // Validar cabecera
      const missingHeaders = (Object.keys(headerData) as (keyof typeof headerData)[])
        .filter((k) => !headerData[k].trim())
      if (missingHeaders.length > 0) {
        setGenerateState('error')
        setToast({ type: 'error', title: 'Error de validación', message: 'Rellena todos los datos de cabecera antes de generar la factura.' })
        resetTimerRef.current = setTimeout(() => setGenerateState('idle'), 4000)
        return
      }

      // Validar que haya filas con datos
      const dataRows = rows.filter((r) => {
        const { id: _id, position: _pos, ...fields } = r
        return Object.values(fields).some((v) => v !== '')
      })
      if (dataRows.length === 0) {
        setGenerateState('error')
        setToast({ type: 'error', title: 'Error de validación', message: 'Añade al menos una fila con datos antes de generar la factura.' })
        resetTimerRef.current = setTimeout(() => setGenerateState('idle'), 4000)
        return
      }

      // Validar campos requeridos en cada fila con datos
      const incomplete = dataRows.some((r) =>
        REQUIRED_ROW_FIELDS.some((key) => !String(r[key] ?? '').trim()),
      )
      if (incomplete) {
        setGenerateState('error')
        setToast({ type: 'error', title: 'Error de validación', message: 'Cada fila debe tener al menos: Producto, Kg y Precio.' })
        resetTimerRef.current = setTimeout(() => setGenerateState('idle'), 4000)
        return
      }

      await save()
      const result = await api.generateInvoice(id)

      setGenerateState('success')
      const links: { label: string; href: string }[] = []
      if (result.invoiceUrl) links.push({ label: 'Ver factura', href: result.invoiceUrl })
      if (result.anexoUrl) links.push({ label: 'Ver anexo IV', href: result.anexoUrl })
      links.push({ label: 'Ver en historial de facturas', href: '/facturas/historial' })
      setToast({ type: 'success', title: 'Factura generada', links })
      resetTimerRef.current = setTimeout(() => setGenerateState('idle'), 4000)
    } catch (err) {
      setGenerateState('error')
      setToast({
        type: 'error',
        title: 'Error al generar',
        message: err instanceof Error ? err.message : 'Error al generar factura',
      })
      resetTimerRef.current = setTimeout(() => setGenerateState('idle'), 4000)
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

  const generateButtonClass =
    generateState === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-600'
      : generateState === 'error'
        ? 'bg-red-600 hover:bg-red-600'
        : generateState === 'generating'
          ? 'bg-gray-400'
          : 'bg-gray-900 hover:bg-gray-800'

  return (
    <div className="space-y-4">
      {toast && (
        <Toast
          type={toast.type}
          title={toast.title}
          message={toast.message}
          links={toast.links}
          onDismiss={() => setToast(null)}
        />
      )}

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
          disabled={generateState === 'generating' || !headerReviewed}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50 ${generateButtonClass}`}
        >
          {generateState === 'generating' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : generateState === 'success' ? (
            <Check className="h-4 w-4" />
          ) : generateState === 'error' ? (
            <X className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generateState === 'generating'
            ? 'Generando...'
            : generateState === 'success'
              ? 'Generado'
              : generateState === 'error'
                ? 'Fallo al generar'
                : 'Generar factura'}
        </button>
      </div>
    </div>
  )
}
