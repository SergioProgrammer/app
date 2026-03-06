import { useCallback, useEffect, useState } from 'react'
import type { HeaderDataClient, SpreadsheetRowClient } from '../types'
import { DEFAULT_HEADER, emptyRow, getWeekString } from '../types'
import * as api from '../services/spreadsheetApi'
import { useAutoSave } from './useAutoSave'

interface UseSpreadsheetOptions {
  id?: string
}

interface SpreadsheetSnapshot {
  name: string
  headerData: HeaderDataClient
  rows: SpreadsheetRowClient[]
  manuallyEdited: Map<string, Set<string>>
}

const MAX_HISTORY_LENGTH = 100

function cloneRows(rows: SpreadsheetRowClient[]): SpreadsheetRowClient[] {
  return rows.map((row) => ({ ...row }))
}

function cloneManuallyEdited(source: Map<string, Set<string>>): Map<string, Set<string>> {
  const cloned = new Map<string, Set<string>>()
  for (const [key, value] of source.entries()) {
    cloned.set(key, new Set(value))
  }
  return cloned
}

export function useSpreadsheet({ id }: UseSpreadsheetOptions) {
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(id ?? null)
  const [name, setName] = useState('Sin nombre')
  const [headerData, setHeaderData] = useState<HeaderDataClient>(DEFAULT_HEADER)
  const [rows, setRows] = useState<SpreadsheetRowClient[]>([emptyRow(0)])
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [history, setHistory] = useState<SpreadsheetSnapshot[]>([])

  // Track manually edited auto-generated fields (keyed by row UUID)
  const [manuallyEdited, setManuallyEdited] = useState<Map<string, Set<string>>>(new Map())

  const markFieldEdited = useCallback((rowId: string, field: string) => {
    setManuallyEdited((prev) => {
      const next = new Map(prev)
      const fields = new Set(next.get(rowId) ?? [])
      fields.add(field)
      next.set(rowId, fields)
      return next
    })
  }, [])

  const isFieldManuallyEdited = useCallback(
    (rowId: string, field: string): boolean => {
      return manuallyEdited.get(rowId)?.has(field) ?? false
    },
    [manuallyEdited],
  )

  const recordSnapshot = useCallback(() => {
    const snapshot: SpreadsheetSnapshot = {
      name,
      headerData: { ...headerData },
      rows: cloneRows(rows),
      manuallyEdited: cloneManuallyEdited(manuallyEdited),
    }
    setHistory((prev) => {
      const next = [...prev, snapshot]
      if (next.length > MAX_HISTORY_LENGTH) {
        return next.slice(next.length - MAX_HISTORY_LENGTH)
      }
      return next
    })
  }, [name, headerData, rows, manuallyEdited])

  // Cargar hoja existente
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    api
      .getSpreadsheet(id)
      .then((data) => {
        if (cancelled) return
        setSpreadsheetId(data.id)
        setName(data.name)
        setHeaderData(data.headerData)
        const loadedRows: SpreadsheetRowClient[] = data.rows.map((r) => ({
          id: r.id,
          position: r.position,
          week: String(r.week ?? ''),
          invoiceDate: String(r.invoiceDate ?? ''),
          date: String(r.date ?? ''),
          finalClient: String(r.finalClient ?? ''),
          kg: String(r.kg ?? ''),
          product: String(r.product ?? ''),
          boxType: String(r.boxType ?? ''),
          abono: String(r.abono ?? ''),
          bundles: String(r.bundles ?? ''),
          price: String(r.price ?? ''),
          awb: String(r.awb ?? ''),
          flightNumber: String(r.flightNumber ?? ''),
          destination: String(r.destination ?? ''),
          incoterm: String(r.incoterm ?? ''),
          deliveryNote: String(r.deliveryNote ?? ''),
          invoiceNumber: String(r.invoiceNumber ?? ''),
          search: String(r.search ?? ''),
        }))
        setRows(loadedRows.length > 0 ? loadedRows : [emptyRow(0)])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Serializar filas para la API
  const serializeRows = useCallback(
    (currentRows: SpreadsheetRowClient[]) =>
      currentRows
        .filter((r) => {
          // Excluir filas completamente vacías
          const { id: _id, position: _pos, ...fields } = r
          return Object.values(fields).some((v) => v !== '')
        })
        .map((r, idx) => ({
          id: r.id,
          position: idx,
          week: r.week || null,
          invoiceDate: r.invoiceDate || null,
          date: r.date || null,
          finalClient: r.finalClient || null,
          kg: r.kg ? Number(r.kg) : null,
          product: r.product || null,
          boxType: r.boxType || null,
          abono: r.abono ? Number(r.abono) : null,
          bundles: r.bundles ? Number(r.bundles) : null,
          price: r.price ? Number(r.price) : null,
          awb: r.awb || null,
          flightNumber: r.flightNumber || null,
          destination: r.destination || null,
          incoterm: r.incoterm || null,
          deliveryNote: r.deliveryNote || null,
          invoiceNumber: r.invoiceNumber || null,
          search: r.search || null,
        })),
    [],
  )

  // Guardar
  const save = useCallback(async (): Promise<void> => {
    if (!spreadsheetId) {
      // Primera vez: crear
      const result = await api.createSpreadsheet(name)
      setSpreadsheetId(result.id)
      if (rows.length > 0 || Object.values(headerData).some((v) => v !== '')) {
        await api.updateSpreadsheet(result.id, {
          name,
          headerData: headerData as unknown as Record<string, string>,
          rows: serializeRows(rows),
        })
      }
      return
    }
    await api.updateSpreadsheet(spreadsheetId, {
      name,
      headerData: headerData as unknown as Record<string, string>,
      rows: serializeRows(rows),
    })
  }, [spreadsheetId, name, headerData, rows, serializeRows])

  const { status: saveStatus, markUnsaved, forceSave } = useAutoSave({
    onSave: save,
    enabled: !!spreadsheetId,
  })

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const snapshot = prev[prev.length - 1]
      setName(snapshot.name)
      setHeaderData({ ...snapshot.headerData })
      setRows(cloneRows(snapshot.rows))
      setManuallyEdited(cloneManuallyEdited(snapshot.manuallyEdited))
      setSelectedRows(new Set())
      markUnsaved()
      return prev.slice(0, -1)
    })
  }, [markUnsaved])

  // Modificaciones de filas
  const calculateBundles = useCallback((kg: string, abono: string): string => {
    const kgNum = parseFloat(kg)
    const abonoNum = parseFloat(abono)
    if (isNaN(kgNum) || isNaN(abonoNum) || abonoNum <= 0) return ''
    return String(Math.ceil(kgNum / abonoNum))
  }, [])

  const updateRow = useCallback(
    (index: number, field: keyof SpreadsheetRowClient, value: string) => {
      recordSnapshot()
      setRows((prev) => {
        const updated = [...prev]
        const row = { ...updated[index], [field]: value }
        const rowId = row.id

        // If user edits an auto-generated field directly, mark it as manually edited
        if (['week', 'date', 'bundles'].includes(field)) {
          markFieldEdited(rowId, field)
        }

        // Auto-calculate week and date when invoiceDate changes
        if (field === 'invoiceDate') {
          if (!isFieldManuallyEdited(rowId, 'week')) {
            row.week = getWeekString(value)
          }
          if (!isFieldManuallyEdited(rowId, 'date')) {
            const d = new Date(value)
            if (!isNaN(d.getTime())) {
              d.setDate(d.getDate() - 1)
              row.date = d.toISOString().slice(0, 10)
            }
          }
        }

        // Auto-calculate bundles when kg or abono changes
        if ((field === 'kg' || field === 'abono') && !isFieldManuallyEdited(rowId, 'bundles')) {
          row.bundles = calculateBundles(row.kg, row.abono)
        }

        updated[index] = row
        return updated
      })
      markUnsaved()
    },
    [markUnsaved, calculateBundles, markFieldEdited, isFieldManuallyEdited, recordSnapshot],
  )

  const addRow = useCallback(() => {
    recordSnapshot()
    setRows((prev) => [...prev, emptyRow(prev.length)])
    markUnsaved()
  }, [markUnsaved, recordSnapshot])

  const deleteRows = useCallback(
    (indices: Set<number>) => {
      recordSnapshot()
      setRows((prev) => {
        const deletedIds = prev.filter((_, i) => indices.has(i)).map((r) => r.id)
        // Clean up manual edit tracking for deleted rows
        if (deletedIds.length > 0) {
          setManuallyEdited((me) => {
            const next = new Map(me)
            deletedIds.forEach((id) => next.delete(id))
            return next
          })
        }
        return prev.filter((_, i) => !indices.has(i)).map((r, i) => ({ ...r, position: i }))
      })
      setSelectedRows(new Set())
      markUnsaved()
    },
    [markUnsaved, recordSnapshot],
  )

  const moveRow = useCallback(
    (from: number, direction: 'up' | 'down') => {
      const to = direction === 'up' ? from - 1 : from + 1
      if (to < 0 || to >= rows.length) return
      recordSnapshot()
      setRows((prev) => {
        const updated = [...prev]
        const temp = updated[from]
        updated[from] = { ...updated[to], position: from }
        updated[to] = { ...temp, position: to }
        return updated
      })
      setSelectedRows((prev) => {
        if (!prev.has(from)) return prev
        const next = new Set(prev)
        next.delete(from)
        next.add(to)
        return next
      })
      markUnsaved()
    },
    [rows.length, markUnsaved, recordSnapshot],
  )

  const duplicateRows = useCallback(
    (indices: Set<number>) => {
      if (indices.size === 0) return
      recordSnapshot()
      setRows((prev) => {
        const toDuplicate = prev.filter((_, i) => indices.has(i))
        const newRows = toDuplicate.map((r, i) => ({
          ...r,
          id: crypto.randomUUID(),
          position: prev.length + i,
        }))
        return [...prev, ...newRows]
      })
      setSelectedRows(new Set())
      markUnsaved()
    },
    [markUnsaved, recordSnapshot],
  )

  const addPastedRows = useCallback(
    (newRows: Omit<SpreadsheetRowClient, 'id' | 'position'>[]) => {
      recordSnapshot()
      setRows((prev) => {
        const mapped = newRows.map((r, i) => ({
          ...r,
          id: crypto.randomUUID(),
          position: prev.length + i,
        }))
        return [...prev, ...mapped]
      })
      markUnsaved()
    },
    [markUnsaved, recordSnapshot],
  )

  const updateHeaderData = useCallback(
    (data: Partial<HeaderDataClient>) => {
      recordSnapshot()
      setHeaderData((prev) => ({ ...prev, ...data }))
      markUnsaved()
    },
    [markUnsaved, recordSnapshot],
  )

  const updateName = useCallback(
    (newName: string) => {
      recordSnapshot()
      setName(newName)
      markUnsaved()
    },
    [markUnsaved, recordSnapshot],
  )

  return {
    spreadsheetId,
    name,
    headerData,
    rows,
    loading,
    error,
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
    canUndo: history.length > 0,
    save: forceSave,
  }
}
