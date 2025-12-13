'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LabelType } from '@/lib/product-selection'
import { LABEL_TYPE_OPTIONS } from '@/lib/product-selection'
import type { VisionOrderItem, VisionOrderParseResult } from '@/lib/vision-orders'
import { deriveLabelTypeFromClient } from '@/lib/vision-orders'
import { createClient } from '@/utils/supabase/client'
import { getPanelSlugForUser } from '@/lib/panel-config'
import { useRouter, useSearchParams } from 'next/navigation'

type ParseStatus = 'idle' | 'loading' | 'done' | 'error'
const VISION_LAST_ORDER_KEY = 'vision:last-order'

export default function VisionOrdersPage() {
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle')
  const [parseError, setParseError] = useState<string | null>(null)
  const [items, setItems] = useState<VisionOrderItem[]>([])
  const [client, setClient] = useState('')
  const [rawText, setRawText] = useState('')
  const [notes, setNotes] = useState('')
  const [tableData, setTableData] = useState<VisionOrderParseResult['table']>(null)
  const [visibleRowIndexes, setVisibleRowIndexes] = useState<Set<number>>(new Set())
  const [panelSlug, setPanelSlug] = useState('general')
  const [pedidoPath, setPedidoPath] = useState<string | null>(null)
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

  useEffect(() => {
    const pedidoPathParam = searchParams?.get('pedidoPath')
    if (!pedidoPathParam || pedidoPathLoaded) return
    setPedidoPathLoaded(true)
    setPedidoPath(pedidoPathParam)
    const clientFromQuery = searchParams?.get('client') ?? ''
    const pedidoId = searchParams?.get('pedidoId') ?? ''
    ;(async () => {
      try {
        setParseStatus('loading')
        setParseError(null)
        setItems([])
        setClient('')
        setRawText('')
        setNotes('')
        setTableData(null)
        setVisibleRowIndexes(new Set())
        const params = new URLSearchParams({ path: pedidoPathParam })
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
            pedidoPath: pedidoPathParam,
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

  const persistableState = useMemo(
    () => ({
      client,
      rawText,
      notes,
      table: tableData,
      items,
      visibleRows: Array.from(visibleRowIndexes),
      pedidoPath,
    }),
    [client, items, notes, pedidoPath, rawText, tableData, visibleRowIndexes],
  )

  const originalOrderUrl = useMemo(() => {
    if (!pedidoPath) return null
    const params = new URLSearchParams({ path: pedidoPath })
    return `/api/pedidos-subidos/file?${params.toString()}`
  }, [pedidoPath])

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
        pedidoPath?: string | null
      }
      const persistedItems = Array.isArray(parsed.items) ? parsed.items : []
      if (persistedItems.length === 0) return
      setItems(persistedItems)
      setClient(parsed.client ?? '')
      setRawText(parsed.rawText ?? '')
      setNotes(parsed.notes ?? '')
      setTableData(parsed.table ?? null)
      setVisibleRowIndexes(new Set(Array.isArray(parsed.visibleRows) ? parsed.visibleRows : []))
      setPedidoPath(parsed.pedidoPath ?? null)
      setParseStatus('done')
    } catch {
      // ignore malformed cache
    }
  }, [parseStatus])

  useEffect(() => {
    if (parseStatus !== 'done') return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(VISION_LAST_ORDER_KEY, JSON.stringify(persistableState))
    } catch {
      // ignore persistence errors
    }
  }, [parseStatus, persistableState])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Registro de Pedidos</h1>
        <p className="text-sm text-gray-600">
          Los pedidos se suben desde “Pedidos subidos”. Aquí los procesamos automáticamente para que revises los datos
          antes de generar etiquetas.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              Revisa los datos detectados y selecciona las líneas que quieres procesar.
            </p>
            {pedidoPath && (
              <p className="text-xs text-gray-500">
                Archivo: <span className="font-semibold text-gray-700">{pedidoPath.split('/').pop() ?? pedidoPath}</span>
              </p>
            )}
            {parseStatus === 'loading' && <p className="text-sm text-gray-700">Procesando pedido…</p>}
            {parseError && <p className="text-sm text-red-600">{parseError}</p>}
            {notes && <p className="text-xs text-gray-500">{notes}</p>}
          </div>
          <button
            type="button"
            onClick={() => originalOrderUrl && window.open(originalOrderUrl, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={!originalOrderUrl}
          >
            Ver pedido original
          </button>
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
                    Procesa un pedido desde “Pedidos subidos” para ver aquí las líneas detectadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Revisa antes de generar</p>
        </div>
      </section>
    </div>
  )
}
