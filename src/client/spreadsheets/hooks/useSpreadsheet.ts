import { useCallback, useEffect, useState } from 'react'
import type { HeaderDataClient, SpreadsheetRowClient } from '../types'
import { DEFAULT_HEADER, emptyRow, getWeekString } from '../types'
import * as api from '../services/spreadsheetApi'
import { useAutoSave } from './useAutoSave'

interface UseSpreadsheetOptions {
  id?: string
}

export function useSpreadsheet({ id }: UseSpreadsheetOptions) {
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(id ?? null)
  const [name, setName] = useState('Sin nombre')
  const [headerData, setHeaderData] = useState<HeaderDataClient>(DEFAULT_HEADER)
  const [rows, setRows] = useState<SpreadsheetRowClient[]>([emptyRow(0)])
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

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
          orderNumber: String(r.orderNumber ?? ''),
          awb: String(r.awb ?? ''),
          deliveryNote: String(r.deliveryNote ?? ''),
          invoiceNumber: String(r.invoiceNumber ?? ''),
          line: String(r.line ?? ''),
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
          orderNumber: r.orderNumber || null,
          awb: r.awb || null,
          deliveryNote: r.deliveryNote || null,
          invoiceNumber: r.invoiceNumber || null,
          line: r.line || null,
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

  // Modificaciones de filas
  const calculateBundles = useCallback((kg: string, abono: string): string => {
    const kgNum = parseFloat(kg)
    const abonoNum = parseFloat(abono)
    if (isNaN(kgNum) || isNaN(abonoNum) || abonoNum <= 0) return ''
    return String(Math.ceil(kgNum / abonoNum))
  }, [])

  const updateRow = useCallback(
    (index: number, field: keyof SpreadsheetRowClient, value: string) => {
      setRows((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], [field]: value }
        // Auto-calcular semana cuando se actualiza invoiceDate
        if (field === 'invoiceDate') {
          updated[index].week = getWeekString(value)
        }
        // Auto-calcular bundles cuando se actualiza kg o abono
        if (field === 'kg' || field === 'abono') {
          updated[index].bundles = calculateBundles(
            updated[index].kg,
            updated[index].abono
          )
        }
        return updated
      })
      markUnsaved()
    },
    [markUnsaved, calculateBundles],
  )

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyRow(prev.length)])
    markUnsaved()
  }, [markUnsaved])

  const deleteRows = useCallback(
    (indices: Set<number>) => {
      setRows((prev) => prev.filter((_, i) => !indices.has(i)).map((r, i) => ({ ...r, position: i })))
      setSelectedRows(new Set())
      markUnsaved()
    },
    [markUnsaved],
  )

  const moveRow = useCallback(
    (from: number, direction: 'up' | 'down') => {
      const to = direction === 'up' ? from - 1 : from + 1
      if (to < 0 || to >= rows.length) return
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
    [rows.length, markUnsaved],
  )

  const duplicateRows = useCallback(
    (indices: Set<number>) => {
      if (indices.size === 0) return
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
    [markUnsaved],
  )

  const addPastedRows = useCallback(
    (newRows: Omit<SpreadsheetRowClient, 'id' | 'position'>[]) => {
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
    [markUnsaved],
  )

  const updateHeaderData = useCallback(
    (data: Partial<HeaderDataClient>) => {
      setHeaderData((prev) => ({ ...prev, ...data }))
      markUnsaved()
    },
    [markUnsaved],
  )

  const updateName = useCallback(
    (newName: string) => {
      setName(newName)
      markUnsaved()
    },
    [markUnsaved],
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
    save: forceSave,
  }
}
