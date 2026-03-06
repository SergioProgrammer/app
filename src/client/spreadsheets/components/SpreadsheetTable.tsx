'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SpreadsheetColumnKey, SpreadsheetRowClient } from '../types'
import { EXAMPLE_ROW, HIGHLIGHT_STYLES, REQUIRED_ROW_FIELDS, SPREADSHEET_COLUMNS } from '../types'

const STORAGE_KEY = 'spreadsheet-column-widths'
const MIN_COL_WIDTH = 70
const MAX_AUTO_FIT_WIDTH = 400

function getInitialWidths(): number[] {
  if (typeof window === 'undefined') return SPREADSHEET_COLUMNS.map((c) => c.width)
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as number[]
      if (parsed.length === SPREADSHEET_COLUMNS.length) return parsed
    }
  } catch {
    // ignore
  }
  return SPREADSHEET_COLUMNS.map((c) => c.width)
}

interface SpreadsheetTableProps {
  rows: SpreadsheetRowClient[]
  selectedRows: Set<number>
  onSelectRows: (selected: Set<number>) => void
  onUpdateRow: (index: number, field: keyof SpreadsheetRowClient, value: string) => void
  onAddRow: () => void
  onActiveRowChange?: (index: number | null) => void
}

export function SpreadsheetTable({
  rows,
  selectedRows,
  onSelectRows,
  onUpdateRow,
  onAddRow,
  onActiveRowChange,
}: SpreadsheetTableProps) {
  const tableRef = useRef<HTMLDivElement>(null)
  const [columnWidths, setColumnWidths] = useState<number[]>(getInitialWidths)
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number; pointerId: number } | null>(null)
  const lastTapRef = useRef<{ colIdx: number; time: number } | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const dragModeRef = useRef<'select' | 'deselect'>('select')
  const lastClickedRowRef = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnWidths))
  }, [columnWidths])

  useEffect(() => {
    if (!isDragging) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isDragging])

  const toggleAll = useCallback(() => {
    if (selectedRows.size === rows.length) {
      onSelectRows(new Set())
    } else {
      onSelectRows(new Set(rows.map((_, i) => i)))
    }
  }, [selectedRows, rows, onSelectRows])

  const handleRowMouseDown = useCallback(
    (rowIdx: number, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedRowRef.current !== null) {
        const from = Math.min(lastClickedRowRef.current, rowIdx)
        const to = Math.max(lastClickedRowRef.current, rowIdx)
        const next = new Set(selectedRows)
        for (let i = from; i <= to; i++) next.add(i)
        onSelectRows(next)
        return
      }
      lastClickedRowRef.current = rowIdx
      const mode = selectedRows.has(rowIdx) ? 'deselect' : 'select'
      dragModeRef.current = mode
      setIsDragging(true)
      const next = new Set(selectedRows)
      if (mode === 'select') next.add(rowIdx)
      else next.delete(rowIdx)
      onSelectRows(next)
    },
    [selectedRows, onSelectRows],
  )

  const handleRowMouseEnter = useCallback(
    (rowIdx: number) => {
      if (!isDragging) return
      const next = new Set(selectedRows)
      if (dragModeRef.current === 'select') next.add(rowIdx)
      else next.delete(rowIdx)
      onSelectRows(next)
    },
    [isDragging, selectedRows, onSelectRows],
  )

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false)
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const tableClassName = useMemo(
    () => `min-w-full border-collapse text-sm${isDragging ? ' select-none' : ''}`,
    [isDragging],
  )

  const focusCell = (row: number, col: number) => {
    requestAnimationFrame(() => {
      const input = tableRef.current?.querySelector<HTMLInputElement>(`[data-row="${row}"][data-col="${col}"]`)
      input?.focus()
    })
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        const isLastCol = colIdx === SPREADSHEET_COLUMNS.length - 1
        const isLastRow = rowIdx === rows.length - 1
        if (isLastCol) {
          if (isLastRow) onAddRow()
          focusCell(rowIdx + 1, 0)
        } else {
          focusCell(rowIdx, colIdx + 1)
        }
      }
    },
    [rows.length, onAddRow],
  )

  const handleAutoFit = useCallback((colIdx: number) => {
    if (!tableRef.current) return
    const cells = tableRef.current.querySelectorAll<HTMLElement>(`[data-col="${colIdx}"]`)
    const headerEl = tableRef.current.querySelector<HTMLElement>(`[data-header-col="${colIdx}"]`)
    let maxWidth = MIN_COL_WIDTH
    cells.forEach((cell) => {
      maxWidth = Math.max(maxWidth, cell.scrollWidth + 16)
    })
    if (headerEl) {
      maxWidth = Math.max(maxWidth, headerEl.scrollWidth + 24)
    }
    maxWidth = Math.min(maxWidth, MAX_AUTO_FIT_WIDTH)
    setColumnWidths((prev) => {
      const next = [...prev]
      next[colIdx] = maxWidth
      return next
    })
  }, [])

  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, colIdx: number) => {
      e.preventDefault()
      e.stopPropagation()

      const now = Date.now()
      const lastTap = lastTapRef.current
      if (e.pointerType === 'touch' && lastTap && lastTap.colIdx === colIdx && now - lastTap.time < 320) {
        handleAutoFit(colIdx)
        lastTapRef.current = null
        return
      }

      lastTapRef.current = e.pointerType === 'touch' ? { colIdx, time: now } : null
      resizingRef.current = { colIdx, startX: e.clientX, startWidth: columnWidths[colIdx], pointerId: e.pointerId }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handlePointerMove = (ev: PointerEvent) => {
        if (!resizingRef.current || resizingRef.current.pointerId !== ev.pointerId) return
        const delta = ev.clientX - resizingRef.current.startX
        const newWidth = Math.max(MIN_COL_WIDTH, resizingRef.current.startWidth + delta)
        setColumnWidths((prev) => {
          const next = [...prev]
          next[resizingRef.current!.colIdx] = newWidth
          return next
        })
      }

      const handlePointerEnd = (ev: PointerEvent) => {
        if (resizingRef.current && resizingRef.current.pointerId !== ev.pointerId) return
        resizingRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerEnd)
        document.removeEventListener('pointercancel', handlePointerEnd)
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerEnd)
      document.addEventListener('pointercancel', handlePointerEnd)
    },
    [columnWidths, handleAutoFit],
  )

  return (
    <div ref={tableRef} className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className={tableClassName} style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 40 }} />
          <col style={{ width: 40 }} />
          {columnWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="border-r border-gray-300 px-2 py-2 text-center">
              <input
                type="checkbox"
                checked={rows.length > 0 && selectedRows.size === rows.length}
                onChange={toggleAll}
                className="rounded border-gray-300"
              />
            </th>
            <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-400">#</th>
            {SPREADSHEET_COLUMNS.map((col, colIdx) => {
              const isRequired = REQUIRED_ROW_FIELDS.includes(col.key)
              return (
                <th
                  key={col.key}
                  className={`relative select-none px-3 py-2 text-left text-sm font-semibold ${isRequired ? 'text-gray-700' : 'text-gray-500'} ${colIdx < SPREADSHEET_COLUMNS.length - 1 ? 'border-r border-gray-300' : ''}`}
                >
                  <span data-header-col={colIdx} className="truncate">
                    {col.label}
                    {isRequired && <span className="ml-0.5 text-red-400">*</span>}
                  </span>
                  <div
                    className="absolute right-0 top-0 h-full w-3 cursor-col-resize hover:bg-blue-300/50 sm:w-1.5"
                    onPointerDown={(e) => handleResizeStart(e, colIdx)}
                    onDoubleClick={() => handleAutoFit(colIdx)}
                  />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className={isDragging ? 'cursor-grabbing' : ''}>
          <tr key="example-row" className="border-b border-gray-200 border-l-4 border-l-amber-400 bg-amber-100/60">
            <td className="px-2 py-1.5 text-center">
              <span className="rounded bg-amber-200 px-1 py-0.5 text-[10px] font-bold uppercase text-amber-700">Ej.</span>
            </td>
            <td className="px-2 py-1.5 text-center text-xs font-medium text-amber-500">—</td>
            {SPREADSHEET_COLUMNS.map((col) => (
              <td key={col.key} className="px-1 py-0.5">
                <span className="block truncate px-1.5 py-1 text-sm font-medium text-amber-700">
                  {col.inputType === 'number'
                    ? Number(EXAMPLE_ROW[col.key as SpreadsheetColumnKey]).toLocaleString('es-ES')
                    : EXAMPLE_ROW[col.key as SpreadsheetColumnKey]}
                </span>
              </td>
            ))}
          </tr>

          {rows.map((row, rowIdx) => (
            <tr
              key={row.id}
              className={`border-b border-gray-100 ${selectedRows.has(rowIdx) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => handleRowMouseEnter(rowIdx)}
            >
              <td className="px-2 py-1 text-center cursor-pointer" onMouseDown={(e) => handleRowMouseDown(rowIdx, e)}>
                <input
                  type="checkbox"
                  readOnly
                  checked={selectedRows.has(rowIdx)}
                  className="rounded border-gray-300 pointer-events-none"
                />
              </td>
              <td className="px-2 py-1 text-center text-xs text-gray-400">{rowIdx + 1}</td>
              {SPREADSHEET_COLUMNS.map((col, colIdx) => {
                const cellValue = row[col.key as SpreadsheetColumnKey]
                return (
                  <td key={col.key} className="px-1 py-0.5">
                    <input
                      data-row={rowIdx}
                      data-col={colIdx}
                      type={col.inputType === 'number' ? 'number' : col.inputType === 'date' ? 'date' : 'text'}
                      step={col.inputType === 'number' ? 'any' : undefined}
                      min={col.inputType === 'number' ? '0' : undefined}
                      value={cellValue}
                      onChange={(e) => onUpdateRow(rowIdx, col.key as keyof SpreadsheetRowClient, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                      onFocus={() => onActiveRowChange?.(rowIdx)}
                      onBlur={() => onActiveRowChange?.(null)}
                      title={
                        col.key === 'bundles'
                          ? 'Auto-calculado: Kg / Abono. Editable.'
                          : col.key === 'week'
                            ? 'Auto-calculado desde fecha factura. Editable.'
                            : col.key === 'date'
                              ? 'Auto-calculado: fecha factura - 1 día. Editable.'
                              : undefined
                      }
                      className={`w-full truncate rounded border-0 px-1.5 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-400 ${
                        ['bundles', 'week', 'date'].includes(col.key)
                          ? `${HIGHLIGHT_STYLES.autoCalc.bg} ${HIGHLIGHT_STYLES.autoCalc.text}`
                          : 'bg-transparent text-gray-900'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}

          <tr key="add-row" className="cursor-pointer border-b border-gray-100 text-gray-400 hover:bg-gray-50" onClick={onAddRow}>
            <td className="px-2 py-2" />
            <td className="px-2 py-2 text-center text-xs">{rows.length + 1}</td>
            <td colSpan={SPREADSHEET_COLUMNS.length} className="px-2 py-2 text-xs italic">
              Click para añadir fila...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
