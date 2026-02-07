'use client'

import { useCallback, useRef } from 'react'
import type { SpreadsheetColumnKey, SpreadsheetRowClient } from '../types'
import { EXAMPLE_ROW, SPREADSHEET_COLUMNS } from '../types'

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

  const toggleRow = useCallback(
    (index: number) => {
      const next = new Set(selectedRows)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      onSelectRows(next)
    },
    [selectedRows, onSelectRows],
  )

  const toggleAll = useCallback(() => {
    if (selectedRows.size === rows.length) {
      onSelectRows(new Set())
    } else {
      onSelectRows(new Set(rows.map((_, i) => i)))
    }
  }, [selectedRows, rows, onSelectRows])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        const isLastCol = colIdx === SPREADSHEET_COLUMNS.length - 1
        const isLastRow = rowIdx === rows.length - 1

        if (e.key === 'Tab') {
          if (isLastCol) {
            // Saltar a primera celda de siguiente fila
            if (isLastRow) onAddRow()
            focusCell(rowIdx + 1, 0)
          } else {
            focusCell(rowIdx, colIdx + 1)
          }
        } else {
          // Enter: bajar a misma columna
          if (isLastRow) onAddRow()
          focusCell(rowIdx + 1, colIdx)
        }
      }
    },
    [rows.length, onAddRow],
  )

  const focusCell = (row: number, col: number) => {
    requestAnimationFrame(() => {
      const input = tableRef.current?.querySelector<HTMLInputElement>(
        `[data-row="${row}"][data-col="${col}"]`,
      )
      input?.focus()
    })
  }

  return (
    <div ref={tableRef} className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="w-10 px-2 py-2 text-center">
              <input
                type="checkbox"
                checked={rows.length > 0 && selectedRows.size === rows.length}
                onChange={toggleAll}
                className="rounded border-gray-300"
              />
            </th>
            <th className="w-10 px-2 py-2 text-center text-xs font-medium text-gray-400">#</th>
            {SPREADSHEET_COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-1 py-2 text-left text-xs font-medium text-gray-500"
                style={{ minWidth: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Fila de ejemplo no editable */}
          <tr key="example-row" className="border-b border-gray-200 border-l-4 border-l-amber-400 bg-amber-100/60">
            <td className="px-2 py-1.5 text-center">
              <span className="rounded bg-amber-200 px-1 py-0.5 text-[10px] font-bold uppercase text-amber-700">Ej.</span>
            </td>
            <td className="px-2 py-1.5 text-center text-xs font-medium text-amber-500">—</td>
            {SPREADSHEET_COLUMNS.map((col) => (
              <td key={col.key} className="px-1 py-0.5">
                <span
                  className="block w-full px-1.5 py-1 text-sm font-medium text-amber-700"
                  style={{ minWidth: col.width - 8 }}
                >
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
            >
              <td className="px-2 py-1 text-center">
                <input
                  type="checkbox"
                  checked={selectedRows.has(rowIdx)}
                  onChange={() => toggleRow(rowIdx)}
                  className="rounded border-gray-300"
                />
              </td>
              <td className="px-2 py-1 text-center text-xs text-gray-400">{rowIdx + 1}</td>
              {SPREADSHEET_COLUMNS.map((col, colIdx) => (
                <td key={col.key} className="px-1 py-0.5">
                  <input
                    data-row={rowIdx}
                    data-col={colIdx}
                    type={col.inputType === 'number' ? 'number' : col.inputType === 'date' ? 'date' : 'text'}
                    step={col.inputType === 'number' ? 'any' : undefined}
                    min={col.inputType === 'number' ? '0' : undefined}
                    value={row[col.key as SpreadsheetColumnKey]}
                    onChange={(e) =>
                      onUpdateRow(rowIdx, col.key as keyof SpreadsheetRowClient, e.target.value)
                    }
                    onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                    onFocus={() => onActiveRowChange?.(rowIdx)}
                    onBlur={() => onActiveRowChange?.(null)}
                    className="w-full rounded border-0 bg-transparent px-1.5 py-1 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-400"
                    style={{ minWidth: col.width - 8 }}
                  />
                </td>
              ))}
            </tr>
          ))}
          {/* Fila vacía para añadir datos */}
          <tr
            key="add-row"
            className="cursor-pointer border-b border-gray-100 text-gray-400 hover:bg-gray-50"
            onClick={onAddRow}
          >
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
