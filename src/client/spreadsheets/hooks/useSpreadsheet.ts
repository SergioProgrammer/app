import { useCallback, useEffect, useMemo, useState } from 'react'
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
          flightNumber: String(r.flightNumber ?? ''),
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
          flightNumber: r.flightNumber || null,
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
        const row = { ...updated[index], [field]: value }
        const rowId = row.id

        // If user edits an auto-generated field directly, mark it as manually edited
        if (['week', 'date', 'bundles', 'awb', 'flightNumber'].includes(field)) {
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
    [markUnsaved, calculateBundles, markFieldEdited, isFieldManuallyEdited],
  )

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyRow(prev.length, headerData.awb)])
    markUnsaved()
  }, [markUnsaved, headerData.awb])

  const deleteRows = useCallback(
    (indices: Set<number>) => {
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

  // Backfill empty AWB fields when header AWB changes
  useEffect(() => {
    const awb = headerData.awb
    if (!awb) return
    setRows((prev) => {
      let changed = false
      const updated = prev.map((row) => {
        if (row.awb === '' && !isFieldManuallyEdited(row.id, 'awb')) {
          changed = true
          return { ...row, awb }
        }
        return row
      })
      return changed ? updated : prev
    })
  }, [headerData.awb, isFieldManuallyEdited])

  // Backfill empty flightNumber fields when header flightNumber changes
  useEffect(() => {
    const flightNumber = headerData.flightNumber
    if (!flightNumber) return
    setRows((prev) => {
      let changed = false
      const updated = prev.map((row) => {
        const rowAwbMatchesHeader = !row.awb || row.awb.trim() === headerData.awb?.trim()
        if (row.flightNumber === '' && rowAwbMatchesHeader && !isFieldManuallyEdited(row.id, 'flightNumber')) {
          changed = true
          return { ...row, flightNumber }
        }
        return row
      })
      return changed ? updated : prev
    })
  }, [headerData.flightNumber, isFieldManuallyEdited])

  // Warn if rows have different flightNumber than header
  // Only applies to rows in the same AWB group as the header (awb empty or matching)
  const multipleFlightWarning = useMemo(() => {
    const headerFlight = headerData.flightNumber?.trim()
    const headerAwb = headerData.awb?.trim()
    if (!headerFlight) return null
    const differentFlights = rows.filter((r) => {
      const rowAwbMatchesHeader = !r.awb?.trim() || r.awb.trim() === headerAwb
      if (!rowAwbMatchesHeader) return false
      const rowFlight = r.flightNumber?.trim()
      return rowFlight && rowFlight !== headerFlight
    })
    if (differentFlights.length === 0) return null
    const uniqueFlights = [...new Set(differentFlights.map((r) => r.flightNumber.trim()))]
    return `${differentFlights.length} fila(s) tienen un Nº vuelo diferente al de cabecera (${uniqueFlights.join(', ')}). Verifica que sea correcto.`
  }, [headerData.flightNumber, rows])

  // Warn if rows have different AWB than header
  const multipleAwbWarning = useMemo(() => {
    const headerAwb = headerData.awb?.trim()
    if (!headerAwb) return null
    const differentAwbs = rows.filter((r) => {
      const rowAwb = r.awb?.trim()
      return rowAwb && rowAwb !== headerAwb
    })
    if (differentAwbs.length === 0) return null
    const uniqueAwbs = [...new Set(differentAwbs.map((r) => r.awb.trim()))]
    return `${differentAwbs.length} fila(s) tienen un AWB diferente al de cabecera (${uniqueAwbs.join(', ')}). Verifica que sea correcto.`
  }, [headerData.awb, rows])

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
    multipleFlightWarning,
    multipleAwbWarning,
    save: forceSave,
  }
}
