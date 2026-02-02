import { useCallback, useEffect, useRef, useState } from 'react'
import type { HeaderDataClient, SpreadsheetRowClient } from '../types'
import { EMPTY_HEADER, emptyRow } from '../types'
import * as api from '../services/spreadsheetApi'
import { useAutoSave } from './useAutoSave'

interface UseSpreadsheetOptions {
  id?: string
}

export function useSpreadsheet({ id }: UseSpreadsheetOptions) {
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(id ?? null)
  const [name, setName] = useState('Sin nombre')
  const [headerData, setHeaderData] = useState<HeaderDataClient>(EMPTY_HEADER)
  const [rows, setRows] = useState<SpreadsheetRowClient[]>([emptyRow(0)])
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const clipboardRef = useRef<SpreadsheetRowClient[]>([])

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
          week: r.week ?? '',
          invoiceDate: r.invoiceDate ?? '',
          date: r.date ?? '',
          finalClient: r.finalClient ?? '',
          kg: r.kg ?? '',
          product: r.product ?? '',
          boxType: r.boxType ?? '',
          bundles: r.bundles ?? '',
          price: r.price ?? '',
          orderNumber: r.orderNumber ?? '',
          awb: r.awb ?? '',
          deliveryNote: r.deliveryNote ?? '',
          invoiceNumber: r.invoiceNumber ?? '',
          line: r.line ?? '',
          search: r.search ?? '',
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
  const save = useCallback(async () => {
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
      return result.id
    }
    await api.updateSpreadsheet(spreadsheetId, {
      name,
      headerData: headerData as unknown as Record<string, string>,
      rows: serializeRows(rows),
    })
    return spreadsheetId
  }, [spreadsheetId, name, headerData, rows, serializeRows])

  const { status: saveStatus, markUnsaved, forceSave } = useAutoSave({
    onSave: save,
    enabled: !!spreadsheetId,
  })

  // Modificaciones de filas
  const updateRow = useCallback(
    (index: number, field: keyof SpreadsheetRowClient, value: string) => {
      setRows((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], [field]: value }
        return updated
      })
      markUnsaved()
    },
    [markUnsaved],
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
      setRows((prev) => {
        const to = direction === 'up' ? from - 1 : from + 1
        if (to < 0 || to >= prev.length) return prev
        const updated = [...prev]
        const temp = updated[from]
        updated[from] = { ...updated[to], position: from }
        updated[to] = { ...temp, position: to }
        return updated
      })
      markUnsaved()
    },
    [markUnsaved],
  )

  const copyRows = useCallback(
    (indices: Set<number>) => {
      clipboardRef.current = rows.filter((_, i) => indices.has(i))
    },
    [rows],
  )

  const pasteRows = useCallback(() => {
    if (clipboardRef.current.length === 0) return
    setRows((prev) => {
      const newRows = clipboardRef.current.map((r, i) => ({
        ...r,
        id: crypto.randomUUID(),
        position: prev.length + i,
      }))
      return [...prev, ...newRows]
    })
    markUnsaved()
  }, [markUnsaved])

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
    copyRows,
    pasteRows,
    addPastedRows,
    updateHeaderData,
    updateName,
    save: forceSave,
  }
}
