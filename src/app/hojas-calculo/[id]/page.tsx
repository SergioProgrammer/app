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
import { CaptureModal } from '@/client/spreadsheets/components/CaptureModal'
import * as api from '@/client/spreadsheets/services/spreadsheetApi'
import type { SpreadsheetRowClient } from '@/client/spreadsheets/types'
import { REQUIRED_ROW_FIELDS, SPREADSHEET_COLUMNS } from '@/client/spreadsheets/types'

type GenerateState = 'idle' | 'generating' | 'success' | 'error'

function validateDeliveryNotes(rows: SpreadsheetRowClient[]): string | null {
  const deliveryNotes = rows
    .map((r) => r.deliveryNote?.trim())
    .filter((note) => note && note !== '')

  if (deliveryNotes.length === 0) {
    return null // Sin albaranes, no hay problema
  }

  const uniqueNotes = new Set(deliveryNotes)
  if (uniqueNotes.size > 1) {
    return `Se encontraron múltiples albaranes diferentes: ${Array.from(uniqueNotes).join(', ')}. Todos los albaranes deben ser iguales.`
  }

  return null // Un único albarán o todos iguales
}

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
    undo,
    canUndo,
    save,
  } = useSpreadsheet({ id })

  const [generateState, setGenerateState] = useState<GenerateState>('idle')
  const [headerReviewed, setHeaderReviewed] = useState(false)
  const [captureModalOpen, setCaptureModalOpen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
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
        .filter((k) => !(headerData[k] ?? '').trim())
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
        setToast({ type: 'error', title: 'Error de validación', message: 'Cada fila debe tener al menos: Producto, Kg, Precio y Abono.' })
        resetTimerRef.current = setTimeout(() => setGenerateState('idle'), 4000)
        return
      }

      // Validar albaranes
      const deliveryNoteError = validateDeliveryNotes(dataRows)
      if (deliveryNoteError) {
        setGenerateState('error')
        setToast({ type: 'error', title: 'Error de validación', message: deliveryNoteError })
        resetTimerRef.current = setTimeout(() => setGenerateState('idle'), 4000)
        return
      }

      await save()
      const result = await api.generateInvoice(id)

      const failedInvoices = result.invoices.filter((inv) => inv.error)
      const successInvoices = result.invoices.filter((inv) => !inv.error)

      if (failedInvoices.length > 0 && successInvoices.length === 0) {
        // All failed
        setGenerateState('error')
        const failedAwbs = failedInvoices.map((inv) => inv.awb || inv.invoiceNumber).join(', ')
        setToast({ type: 'error', title: 'Error al generar facturas', message: `Errores en AWB: ${failedAwbs}` })
        resetTimerRef.current = setTimeout(() => setGenerateState('idle'), 4000)
        return
      }

      setGenerateState('success')
      const links: { label: string; href: string }[] = []
      for (const inv of successInvoices) {
        if (inv.invoiceUrl) links.push({ label: `Factura ${inv.invoiceNumber}`, href: inv.invoiceUrl })
        if (inv.anexoUrl) links.push({ label: `Anexo IV (${inv.invoiceNumber})`, href: inv.anexoUrl })
      }
      links.push({ label: 'Ver en historial de facturas', href: '/facturas/historial' })
      const count = successInvoices.length
      const total = result.invoices.length

      if (failedInvoices.length > 0) {
        const failedAwbs = failedInvoices.map((inv) => inv.awb || inv.invoiceNumber).join(', ')
        setToast({
          type: 'error',
          title: `${count} de ${total} facturas generadas`,
          message: `Errores en AWB: ${failedAwbs}`,
          links,
        })
      } else if (result.warnings?.length > 0) {
        setToast({
          type: 'error',
          title: `${count} factura${count !== 1 ? 's' : ''} generada${count !== 1 ? 's' : ''} con advertencias`,
          message: result.warnings.join('\n'),
          links,
        })
      } else {
        setToast({ type: 'success', title: `${count} factura${count !== 1 ? 's' : ''} generada${count !== 1 ? 's' : ''}`, links })
      }
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

  const handleCapture = useCallback(async (selectedColumns: string[]) => {
    setCaptureModalOpen(false)
    const captureRows = rows.filter((_, i) => selectedRows.has(i))
    if (captureRows.length === 0) return

    if (captureRows.length > 200) {
      const ok = window.confirm(
        `Se van a capturar ${captureRows.length} filas. Esto puede tardar unos segundos. ¿Continuar?`
      )
      if (!ok) return
    }

    const colDefs = SPREADSHEET_COLUMNS.filter((c) => selectedColumns.includes(c.key))

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:0;background:#ffffff;padding:12px;font-family:Arial,sans-serif;font-size:13px;color:#111827'

    const table = document.createElement('table')
    table.style.cssText = 'border-collapse:collapse;color:#111827'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    colDefs.forEach((col) => {
      const th = document.createElement('th')
      th.textContent = col.label
      th.style.cssText = 'border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;color:#111827;font-weight:700;white-space:nowrap;text-align:left'
      headerRow.appendChild(th)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    captureRows.forEach((row) => {
      const tr = document.createElement('tr')
      colDefs.forEach((col) => {
        const td = document.createElement('td')
        td.textContent = String(row[col.key as keyof SpreadsheetRowClient] ?? '')
        td.style.cssText = 'border:1px solid #e5e7eb;padding:5px 10px;white-space:nowrap;color:#111827'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    container.appendChild(table)
    document.body.appendChild(container)

    setIsCapturing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.download = `${name || 'captura'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      setToast({
        type: 'error',
        title: 'Error al capturar',
        message: err instanceof Error ? err.message : 'No se pudo generar la imagen',
      })
    } finally {
      document.body.removeChild(container)
      setIsCapturing(false)
    }
  }, [rows, selectedRows, name])

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

  const uniqueAwbCount = new Set(
    rows.map((r) => r.awb?.trim() || '').filter(Boolean)
  ).size

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

      <PasteFromExcel onPaste={addPastedRows} />

      <SpreadsheetToolbar
        saveStatus={saveStatus}
        selectedCount={selectedRows.size}
        onSave={save}
        onUndo={undo}
        canUndo={canUndo}
        onAddRow={addRow}
        onDeleteRows={() => deleteRows(selectedRows)}
        onDuplicate={() => duplicateRows(selectedRows)}
        onMoveUp={() => selectedIndex >= 0 && moveRow(selectedIndex, 'up')}
        onMoveDown={() => selectedIndex >= 0 && moveRow(selectedIndex, 'down')}
        onCapture={() => !isCapturing && setCaptureModalOpen(true)}
        isCapturing={isCapturing}
      />

      <SpreadsheetTable
        rows={rows}
        selectedRows={selectedRows}
        onSelectRows={setSelectedRows}
        onUpdateRow={updateRow}
        onAddRow={addRow}
      />

      <SpreadsheetHeaderForm data={headerData} onChange={updateHeaderData} />

      <CaptureModal
        open={captureModalOpen}
        onClose={() => setCaptureModalOpen(false)}
        onConfirm={handleCapture}
        selectedRowCount={selectedRows.size}
      />

      <div className="flex flex-col items-end gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={headerReviewed}
            onChange={(e) => setHeaderReviewed(e.target.checked)}
            className="cursor-pointer rounded border-gray-300"
          />
          He revisado las especificaciones y los datos por fila
        </label>
        <button
          onClick={handleGenerate}
          disabled={generateState === 'generating' || !headerReviewed}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-50 ${generateButtonClass}`}
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
                : uniqueAwbCount > 1
                  ? `Generar ${uniqueAwbCount} facturas`
                  : 'Generar factura'}
        </button>
      </div>
    </div>
  )
}
