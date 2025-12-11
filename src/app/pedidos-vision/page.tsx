'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { LabelType } from '@/lib/product-selection'
import { LABEL_TYPE_OPTIONS } from '@/lib/product-selection'
import type { VisionOrderItem, VisionOrderParseResult } from '@/lib/vision-orders'
import { deriveLabelTypeFromClient } from '@/lib/vision-orders'
import { createClient } from '@/utils/supabase/client'
import { getPanelSlugForUser } from '@/lib/panel-config'
import { useRouter, useSearchParams } from 'next/navigation'

type ParseStatus = 'idle' | 'loading' | 'done' | 'error'
const VISION_LAST_ORDER_KEY = 'vision:last-order'

function parseUnits(value: string | undefined | null): number {
  if (!value) return 1
  const match = value.match(/([0-9]+(?:[.,][0-9]+)?)/)
  if (!match) return 1
  const parsed = Number.parseFloat(match[1].replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return Math.round(parsed)
}

export default function VisionOrdersPage() {
  const [file, setFile] = useState<File | null>(null)
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle')
  const [parseError, setParseError] = useState<string | null>(null)
  const [items, setItems] = useState<VisionOrderItem[]>([])
  const [client, setClient] = useState('')
  const [rawText, setRawText] = useState('')
  const [notes, setNotes] = useState('')
  const [tableData, setTableData] = useState<VisionOrderParseResult['table']>(null)
  const [visibleRowIndexes, setVisibleRowIndexes] = useState<Set<number>>(new Set())
  const [panelSlug, setPanelSlug] = useState('general')
  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const [pedidoPathLoaded, setPedidoPathLoaded] = useState(false)

  useEffect(() => {
    async function resolvePanelSlug() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const slug = getPanelSlugForUser(session?.user ?? null)
        setPanelSlug(slug)
      } catch {
        setPanelSlug('general')
      }
    }
    void resolvePanelSlug()
  }, [supabase])

  const parseFile = useCallback(
    async (selectedFile: File) => {
      setParseStatus('loading')
      setParseError(null)
      setItems([])
      setClient('')
      setRawText('')
      setNotes('')
      setTableData(null)
      setVisibleRowIndexes(new Set())

      const formData = new FormData()
      formData.append('file', selectedFile)
      try {
        const response = await fetch('/api/vision-orders/parse', { method: 'POST', body: formData })
        if (!response.ok) {
          throw new Error('No se pudo leer el pedido')
        }
        const payload = (await response.json()) as { data: VisionOrderParseResult }
        const parsedItems = payload.data.items ?? []
        setItems(parsedItems)
        setClient(payload.data.client ?? '')
        setRawText(payload.data.rawText ?? '')
        setNotes(payload.data.notes ?? '')
        setTableData(payload.data.table ?? null)
        setVisibleRowIndexes(new Set())
        try {
          const persisted = {
            client: payload.data.client ?? '',
            rawText: payload.data.rawText ?? '',
            notes: payload.data.notes ?? '',
            table: payload.data.table ?? null,
            items: parsedItems,
            visibleRows: [],
          }
          window.localStorage.setItem(VISION_LAST_ORDER_KEY, JSON.stringify(persisted))
        } catch {
          // ignore persistence errors
        }
        setParseStatus('done')
      } catch (error) {
        console.error(error)
        setParseError('No se pudo leer el pedido. Intenta de nuevo o rellena manualmente.')
        setParseStatus('error')
      }
    },
    [],
  )

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.files?.[0]
      setFile(next ?? null)
      if (next) {
        void parseFile(next)
      }
    },
    [parseFile],
  )

  const handleParse = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!file) {
        setParseError('Selecciona un archivo PDF, imagen o Excel (XLSX/CSV).')
        return
      }
      void parseFile(file)
    },
    [file, parseFile],
  )

  useEffect(() => {
    const pedidoPath = searchParams?.get('pedidoPath')
    if (!pedidoPath || pedidoPathLoaded) return
    setPedidoPathLoaded(true)
    const clientFromQuery = searchParams?.get('client') ?? ''
    const pedidoId = searchParams?.get('pedidoId') ?? ''
    ;(async () => {
      try {
        setParseStatus('loading')
        const params = new URLSearchParams({ path: pedidoPath })
        if (pedidoId) params.set('id', pedidoId)
        const response = await fetch(`/api/pedidos-subidos/process?${params.toString()}`, {
          method: 'POST',
        })
        if (!response.ok) {
          throw new Error('No se pudo procesar el pedido.')
        }
        const payload = (await response.json()) as { data: VisionOrderParseResult }
        const parsedItems = payload.data.items ?? []
        setItems(parsedItems)
        setClient(clientFromQuery || payload.data.client || '')
        setRawText(payload.data.rawText ?? '')
        setNotes(payload.data.notes ?? '')
        setTableData(payload.data.table ?? null)
        setVisibleRowIndexes(new Set())
        try {
          const persisted = {
            client: clientFromQuery || payload.data.client || '',
            rawText: payload.data.rawText ?? '',
            notes: payload.data.notes ?? '',
            table: payload.data.table ?? null,
            items: parsedItems,
            visibleRows: [],
          }
          window.localStorage.setItem(VISION_LAST_ORDER_KEY, JSON.stringify(persisted))
        } catch {
          // ignore persistence errors
        }
        setParseStatus('done')
      } catch (err) {
        console.error(err)
        setParseError('No se pudo procesar el pedido.')
        setParseStatus('error')
      }
    })()
  }, [pedidoPathLoaded, searchParams])

  const handleToggleInclude = useCallback(
    (id: string) => {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, include: !item.include } : item)))
    },
    [],
  )

  const handleFieldChange = useCallback(
    (id: string, field: keyof Pick<VisionOrderItem, 'productName' | 'quantityText' | 'client' | 'labelType'>, value: string) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, [field]: field === 'labelType' ? (value as LabelType) : value } : item)),
      )
    },
    [],
  )

  const handleReview = useCallback(
    (item: VisionOrderItem) => {
      const params = new URLSearchParams()
      params.set('vision', '1')
      params.set('product', item.productName)
      params.set('quantity', item.quantityText)
      const rawCantidad = item.quantityText
      const parsedUnits = Number(String(rawCantidad ?? '').replace(/[^\d]/g, ''))
      console.log('[pedidos-vision] rawCantidad', rawCantidad, 'parsedUnits', parsedUnits)
      params.set('units', String(parsedUnits))
      if (item.client || client) {
        params.set('client', item.client || client)
      }
      if (item.labelType) {
        params.set('labelType', item.labelType)
      }
      params.set('returnTo', '/pedidos-vision')
      const target = `/panel/${panelSlug}?${params.toString()}`
      router.push(target)
    },
    [client, panelSlug, router],
  )

  const handleClientChange = useCallback(
    (value: string) => {
      setClient(value)
      const nextLabelType = deriveLabelTypeFromClient(value)
      setItems((current) => current.map((item) => ({ ...item, client: value, labelType: nextLabelType })))
    },
    [],
  )

  const handleRowVisibilityToggle = useCallback((rowIndex: number) => {
    setVisibleRowIndexes((current) => {
      const next = new Set(current)
      if (next.has(rowIndex)) {
        next.delete(rowIndex)
      } else {
        next.add(rowIndex)
      }
      return next
    })
  }, [])

  const handleSelectAllRows = useCallback(() => {
    setVisibleRowIndexes(new Set(items.map((_, index) => index)))
  }, [items])

  const handleClearSelection = useCallback(() => {
    setVisibleRowIndexes(new Set())
  }, [])

  const displayedItems = useMemo(() => {
    if (!tableData) return items
    if (visibleRowIndexes.size === 0) return []
    return items.filter((_, index) => visibleRowIndexes.has(index))
  }, [items, tableData, visibleRowIndexes])

  useEffect(() => {
    if (parseStatus !== 'idle') return
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(VISION_LAST_ORDER_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as {
        client?: string
        rawText?: string
        notes?: string
        table?: VisionOrderParseResult['table'] | null
        items?: VisionOrderItem[]
        visibleRows?: number[]
      }
      const persistedItems = Array.isArray(parsed.items) ? parsed.items : []
      if (persistedItems.length === 0) return
      setItems(persistedItems)
      setClient(parsed.client ?? '')
      setRawText(parsed.rawText ?? '')
      setNotes(parsed.notes ?? '')
      setTableData(parsed.table ?? null)
      setVisibleRowIndexes(new Set(Array.isArray(parsed.visibleRows) ? parsed.visibleRows : []))
      setParseStatus('done')
    } catch {
      // ignore malformed cache
    }
  }, [parseStatus])

  useEffect(() => {
    if (parseStatus !== 'done') return
    if (typeof window === 'undefined') return
    try {
      const persisted = {
        client,
        rawText,
        notes,
        table: tableData,
        items,
        visibleRows: Array.from(visibleRowIndexes),
      }
      window.localStorage.setItem(VISION_LAST_ORDER_KEY, JSON.stringify(persisted))
    } catch {
      // ignore persistence errors
    }
  }, [client, items, notes, parseStatus, rawText, tableData, visibleRowIndexes])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Registro de Pedidos</h1>
        <p className="text-sm text-gray-600">
          Sube un pedido en PDF, imagen o Excel (XLSX/CSV), lo registramos y confirma los datos antes de generar etiquetas.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Paso 1. Subir pedido</h2>
          <span className="text-xs font-medium text-gray-500">Formatos: PDF, imagen o Excel/CSV</span>
        </div>
        <form onSubmit={handleParse} className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              ref={hiddenFileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.xlsm,.csv,.tsv,.ods"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
              onClick={() => hiddenFileInputRef.current?.click()}
            >
              Subir archivo
            </button>
            {file && <span className="text-sm text-gray-700">Archivo: {file.name}</span>}
          </div>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.xlsm,.csv,.tsv,.ods"
            onChange={handleFileChange}
            className="block w-full text-sm"
          />
          {file && <p className="text-sm text-gray-700">Archivo seleccionado: {file.name}</p>}
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            disabled={!file || parseStatus === 'loading'}
          >
            {parseStatus === 'loading' ? 'Leyendo pedido…' : 'Leer pedido con visión'}
          </button>
          {parseError && <p className="text-sm text-red-600">{parseError}</p>}
          {notes && <p className="text-xs text-gray-500">{notes}</p>}
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Paso 2. Revisar y confirmar</h2>
          <span className="text-xs font-medium text-gray-500">Completa o corrige los datos antes de generar</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Cliente / empresa
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
              value={client}
              onChange={(event) => handleClientChange(event.target.value)}
              placeholder="Mercadona, Aldi, Lidl…"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Texto leído (resumen)
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={2}
              placeholder="Texto detectado en el pedido"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          {tableData && tableData.headers.length > 0 && (
            <div className="mb-5 rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Tabla leída del pedido</p>
                  <p className="text-xs text-gray-600">
                    Mostramos las columnas tal como vienen en la hoja de cálculo.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">
                    {tableData.headers.length} columnas · {tableData.rows.length} filas
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllRows}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      Seleccionar todo
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Mostrar</th>
                      {tableData.headers.map((header) => (
                        <th key={header} className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {tableData.rows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={visibleRowIndexes.has(rowIndex)}
                            onChange={() => handleRowVisibilityToggle(rowIndex)}
                          />
                        </td>
                        {row.map((cell, cellIndex) => (
                          <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-sm text-gray-700">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {tableData.rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={(tableData.headers.length || 1) + 1}
                          className="px-3 py-4 text-center text-sm text-gray-500"
                        >
                          No se pudieron leer filas de la hoja de cálculo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Incluir</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Producto</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Cantidad</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Cliente</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Tipo etiqueta</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedItems.map((item) => (
                <tr key={item.id} className={!item.include ? 'bg-gray-50' : undefined}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.include !== false}
                      onChange={() => handleToggleInclude(item.id)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                      value={item.productName}
                      onChange={(event) => handleFieldChange(item.id, 'productName', event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                      value={item.quantityText}
                      onChange={(event) => handleFieldChange(item.id, 'quantityText', event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                      value={item.client}
                      onChange={(event) => handleFieldChange(item.id, 'client', event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                      value={item.labelType}
                      onChange={(event) => handleFieldChange(item.id, 'labelType', event.target.value)}
                    >
                      {Object.entries(LABEL_TYPE_OPTIONS).map(([value, option]) => (
                        <option key={value} value={value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleReview(item)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      disabled={!item.include}
                    >
                      Generar esta etiqueta
                    </button>
                  </td>
                </tr>
              ))}
              {displayedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    Sube un pedido y pulsa “Leer pedido con visión” para ver las líneas detectadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Paso 3. Revisar antes de generar</p>
          <p className="text-xs text-gray-600">
            Usa el botón “Revisar y generar” en cada línea para abrir la pantalla de datos editables con los campos
            pre-rellenos. La generación y guardado se harán allí.
          </p>
        </div>
      </section>
    </div>
  )
}
