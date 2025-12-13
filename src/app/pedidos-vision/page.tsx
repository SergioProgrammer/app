'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { LabelType } from '@/lib/product-selection'
import { LABEL_TYPE_OPTIONS } from '@/lib/product-selection'
import type { VisionOrderItem, VisionOrderParseResult } from '@/lib/vision-orders'
import { deriveLabelTypeFromClient } from '@/lib/vision-orders'
import { createClient } from '@/utils/supabase/client'
import { getPanelSlugForUser } from '@/lib/panel-config'
import { useRouter, useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'

type ParseStatus = 'idle' | 'loading' | 'done' | 'error'
const VISION_LAST_ORDER_KEY = 'vision:last-order'

interface QuickItem {
  id: string
  productName: string
  units: number
  selected: boolean
}

function parseUnits(value: string | undefined | null): number {
  if (!value) return 1
  const match = value.match(/([0-9]+(?:[.,][0-9]+)?)/)
  if (!match) return 1
  const parsed = Number.parseFloat(match[1].replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return Math.round(parsed)
}

function isNumericProductName(value: string | undefined | null): boolean {
  const normalized = (value ?? '').trim()
  if (!normalized) return true
  return /^[\d\s.,-]+$/.test(normalized)
}

export default function VisionOrdersPage() {
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle')
  const [parseError, setParseError] = useState<string | null>(null)
  const [items, setItems] = useState<VisionOrderItem[]>([])
  const [client, setClient] = useState('')
  const [rawText, setRawText] = useState('')
  const [notes, setNotes] = useState('')
  const [tableData, setTableData] = useState<VisionOrderParseResult['table']>(null)
  const [quickItems, setQuickItems] = useState<QuickItem[]>([])
  const [panelSlug, setPanelSlug] = useState('general')
  const [pedidoPath, setPedidoPath] = useState<string | null>(null)
  const [xlsxPreview, setXlsxPreview] = useState<string[][] | null>(null)
  const [xlsxError, setXlsxError] = useState<string | null>(null)
  const [xlsxLoading, setXlsxLoading] = useState(false)
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [localUrl, setLocalUrl] = useState<string | null>(null)
  const lastProcessedPathRef = useRef<string | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const cameFromPedidosSubidos = useMemo(() => Boolean(searchParams?.get('pedidoPath')), [searchParams])
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
    if (!pedidoPathParam) return
    if (lastProcessedPathRef.current === pedidoPathParam) return
    lastProcessedPathRef.current = pedidoPathParam
    setPedidoPath(pedidoPathParam)
    setLocalFile(null)
    setLocalUrl(null)
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
        setQuickItems([])
        setXlsxPreview(null)
        setXlsxError(null)
        setXlsxLoading(false)
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
        const parsedQuickItems = parsedItems
          .filter((item) => !isNumericProductName(item.productName))
          .map((item) => ({
            id: item.id,
            productName: item.productName,
            units: parseUnits(item.quantityText),
            selected: false,
          }))
        setItems(parsedItems)
        setClient(clientFromQuery || payload.data.client || '')
        setRawText(payload.data.rawText ?? '')
        setNotes(payload.data.notes ?? '')
        setTableData(payload.data.table ?? null)
        setQuickItems(parsedQuickItems)
        try {
          const persisted = {
            client: clientFromQuery || payload.data.client || '',
            rawText: payload.data.rawText ?? '',
            notes: payload.data.notes ?? '',
            table: payload.data.table ?? null,
            items: parsedItems,
            pedidoPath: pedidoPathParam,
            quickItems: parsedQuickItems,
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
  }, [searchParams])

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
      if (field === 'productName') {
        setQuickItems((current) => current.map((quick) => (quick.id === id ? { ...quick, productName: value } : quick)))
      }
      if (field === 'quantityText') {
        const units = parseUnits(value)
        setQuickItems((current) => current.map((quick) => (quick.id === id ? { ...quick, units } : quick)))
      }
    },
    [],
  )

  const handleLocalFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null
      setXlsxPreview(null)
      setXlsxError(null)
      setXlsxLoading(false)
      setPedidoPath(null)
      if (localUrl) {
        URL.revokeObjectURL(localUrl)
      }
      if (!file) {
        setLocalFile(null)
        setLocalUrl(null)
      } else {
        const url = URL.createObjectURL(file)
        setLocalFile(file)
        setLocalUrl(url)
      }
      event.target.value = ''
    },
    [localUrl],
  )

  const handleToggleQuickItem = useCallback((id: string) => {
    setQuickItems((current) => current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)))
    setItems((current) => current.map((item) => (item.id === id ? { ...item, include: true } : item)))
  }, [])

  const handleReview = useCallback(
    (item: VisionOrderItem) => {
      const quickItem = quickItems.find((quick) => quick.id === item.id)
      const params = new URLSearchParams()
      params.set('vision', '1')
      params.set('product', item.productName)
      params.set('quantity', item.quantityText)
      const parsedUnits = quickItem?.units ?? parseUnits(item.quantityText)
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
    [client, panelSlug, quickItems, router],
  )

  const handleClientChange = useCallback(
    (value: string) => {
      setClient(value)
      const nextLabelType = deriveLabelTypeFromClient(value)
      setItems((current) => current.map((item) => ({ ...item, client: value, labelType: nextLabelType })))
    },
    [],
  )

  const selectedQuickIds = useMemo(
    () => new Set(quickItems.filter((item) => item.selected).map((item) => item.id)),
    [quickItems],
  )

  const displayedItems = useMemo(
    () => items.filter((item) => selectedQuickIds.has(item.id)),
    [items, selectedQuickIds],
  )

  const persistableState = useMemo(
    () => ({
      client,
      rawText,
      notes,
      table: tableData,
      items,
      pedidoPath,
      quickItems,
    }),
    [client, items, notes, pedidoPath, quickItems, rawText, tableData],
  )

  const originalUrl = useMemo(() => {
    if (!pedidoPath) return null
    const params = new URLSearchParams({ path: pedidoPath })
    return `/api/pedidos-subidos/file?${params.toString()}`
  }, [pedidoPath])

  const originalExtension = useMemo(() => {
    if (pedidoPath) return (pedidoPath.split('.').pop() ?? '').toLowerCase()
    return ''
  }, [pedidoPath])

  const effectiveUrl = useMemo(() => localUrl ?? originalUrl, [localUrl, originalUrl])
  const effectiveExtension = useMemo(() => {
    const fromLocal = localFile?.name ? localFile.name.split('.').pop() : ''
    return (fromLocal || originalExtension || '').toLowerCase()
  }, [localFile?.name, originalExtension])

  useEffect(() => {
    const isExcel = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'xlsm'].includes(effectiveExtension)
    if (!effectiveUrl || !isExcel) {
      setXlsxPreview(null)
      setXlsxError(null)
      setXlsxLoading(false)
      return
    }
    let cancelled = false
    const loadExcel = async () => {
      setXlsxLoading(true)
      setXlsxError(null)
      try {
        const arrayBuffer = localFile
          ? await localFile.arrayBuffer()
          : await (async () => {
              const response = await fetch(effectiveUrl)
              if (!response.ok) {
                throw new Error('No se pudo cargar el archivo.')
              }
              return response.arrayBuffer()
            })()
        if (cancelled) return
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) throw new Error('No se encontró hoja de cálculo.')
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) throw new Error('No se pudo leer la hoja.')
        const rows = (XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number | null | undefined)[][]).map((row) =>
          row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))),
        )
        setXlsxPreview(rows)
      } catch (error) {
        console.error('[pedidos-vision] excel preview error', error)
        if (!cancelled) {
          setXlsxPreview(null)
          setXlsxError('No se pudo generar la vista previa del Excel.')
        }
      } finally {
        if (!cancelled) setXlsxLoading(false)
      }
    }
    void loadExcel()
    return () => {
      cancelled = true
    }
  }, [effectiveExtension, effectiveUrl, localFile])

  useEffect(() => {
    if (parseStatus !== 'idle') return
    if (cameFromPedidosSubidos) return
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
        pedidoPath?: string | null
        quickItems?: QuickItem[]
      }
      const persistedItems = Array.isArray(parsed.items) ? parsed.items : []
      if (persistedItems.length === 0) return
      const persistedQuickItems = Array.isArray(parsed.quickItems)
        ? parsed.quickItems.map((item) => ({
            ...item,
            selected: Boolean(item.selected),
            units: Number.isFinite(item.units) ? item.units : parseUnits(persistedItems.find((it) => it.id === item.id)?.quantityText),
          }))
        : persistedItems
            .filter((item) => !isNumericProductName(item.productName))
            .map((item) => ({
              id: item.id,
              productName: item.productName,
              units: parseUnits(item.quantityText),
              selected: false,
            }))
      setItems(persistedItems)
      setClient(parsed.client ?? '')
      setRawText(parsed.rawText ?? '')
      setNotes(parsed.notes ?? '')
      setTableData(parsed.table ?? null)
      setQuickItems(persistedQuickItems)
      setPedidoPath(parsed.pedidoPath ?? null)
      setXlsxPreview(null)
      setXlsxError(null)
      setXlsxLoading(false)
      setParseStatus('done')
    } catch {
      // ignore malformed cache
    }
  }, [parseStatus, cameFromPedidosSubidos])

  useEffect(() => {
    if (parseStatus !== 'done') return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(VISION_LAST_ORDER_KEY, JSON.stringify(persistableState))
    } catch {
      // ignore persistence errors
    }
  }, [parseStatus, persistableState])

  useEffect(
    () => () => {
      if (localUrl) URL.revokeObjectURL(localUrl)
    },
    [localUrl],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Registro de Pedidos</h1>
        <p className="text-sm text-gray-600">
          Los pedidos se suben desde “Pedidos subidos”. Aquí los procesamos automáticamente para que revises los datos
          antes de generar etiquetas.
        </p>
        {notes && <p className="text-xs text-gray-500">{notes}</p>}
        {parseStatus === 'loading' && <p className="text-sm text-gray-700">Procesando pedido…</p>}
        {parseError && <p className="text-sm text-red-600">{parseError}</p>}
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-gray-900">Pedido original</p>
            {pedidoPath && (
              <p className="text-xs text-gray-500">
                Archivo: <span className="font-semibold text-gray-700">{pedidoPath.split('/').pop() ?? pedidoPath}</span>
              </p>
            )}
            {localFile && (
              <p className="text-xs text-gray-500">
                Archivo local: <span className="font-semibold text-gray-700">{localFile.name}</span>
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <span className="hidden sm:inline">Subir desde navegador</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.xlsm,.csv,.tsv,.ods"
              className="hidden"
              onChange={handleLocalFileChange}
            />
            <span className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm hover:bg-gray-50">
              Elegir archivo
            </span>
          </label>
          <a
            href={effectiveUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            aria-disabled={!effectiveUrl}
            onClick={(event) => {
              if (!effectiveUrl) {
                event.preventDefault()
              }
            }}
          >
            Abrir en nueva pestaña
          </a>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          {effectiveUrl ? (
            (() => {
              const isPdf = effectiveExtension === 'pdf'
              const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(effectiveExtension)
              const isExcel = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'xlsm'].includes(effectiveExtension)

              if (isPdf) {
                return (
                  <object data={effectiveUrl} type="application/pdf" className="h-[70vh] w-full rounded-lg bg-white">
                    <p className="text-sm text-gray-700">
                      Tu navegador no puede mostrar el PDF.{' '}
                      <a className="text-emerald-700 underline" href={effectiveUrl} target="_blank" rel="noreferrer">
                        Ábrelo en una pestaña nueva.
                      </a>
                      <span className="mx-1">·</span>
                      <iframe title="PDF fallback" src={effectiveUrl} className="h-64 w-full rounded border border-gray-200" />
                    </p>
                  </object>
                )
              }

              if (isImage) {
                return (
                  <div className="relative mx-auto h-[70vh] w-full rounded-lg bg-white">
                    <Image
                      src={effectiveUrl}
                      alt="Pedido original"
                      fill
                      unoptimized
                      className="object-contain rounded-lg"
                      sizes="(min-width: 1024px) 960px, 100vw"
                    />
                  </div>
                )
              }

              if (isExcel) {
                if (xlsxLoading) {
                  return <p className="text-sm text-gray-700">Cargando vista previa de Excel…</p>
                }
                if (xlsxError) {
                  return (
                    <p className="text-sm text-red-600">
                      {xlsxError}{' '}
                      <a className="text-emerald-700 underline" href={effectiveUrl} target="_blank" rel="noreferrer">
                        Abrir en pestaña nueva
                      </a>
                    </p>
                  )
                }
                if (xlsxPreview && xlsxPreview.length > 0) {
                  return (
                    <div className="max-h-[70vh] overflow-auto rounded-lg border border-gray-200 bg-white">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {xlsxPreview[0].map((header, index) => (
                              <th key={`xlsx-header-${index}`} className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {xlsxPreview.slice(1).map((row, rowIndex) => (
                            <tr key={`xlsx-row-${rowIndex}`} className="hover:bg-gray-50">
                              {row.map((cell, cellIndex) => (
                                <td key={`xlsx-cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-sm text-gray-700">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {xlsxPreview.length === 1 && (
                            <tr>
                              <td colSpan={xlsxPreview[0].length || 1} className="px-3 py-4 text-center text-sm text-gray-500">
                                Sin filas en la hoja.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )
                }
                return (
                  <p className="text-sm text-gray-700">
                    Vista previa no disponible.{' '}
                    <a className="text-emerald-700 underline" href={effectiveUrl} target="_blank" rel="noreferrer">
                      Ábrelo en una pestaña nueva.
                    </a>
                  </p>
                )
              }

              return (
                <p className="text-sm text-gray-700">
                  Vista previa no disponible.{' '}
                  <a className="text-emerald-700 underline" href={effectiveUrl} target="_blank" rel="noreferrer">
                    Ábrelo en una pestaña nueva.
                  </a>
                </p>
              )
            })()
          ) : (
            <p className="text-sm text-gray-700">Sube los pedidos desde “Pedidos subidos” para ver el documento aquí.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900">Vista rápida</p>
            <p className="text-xs text-gray-600">Selecciona las líneas que quieres procesar. Datos generados automáticamente por visión.</p>
          </div>
          <div className="text-xs font-medium text-gray-500">
            {quickItems.filter((item) => item.selected).length} seleccionados / {quickItems.length} totales
          </div>
        </div>
        <div className="grid gap-2">
          {quickItems.length === 0 && (
            <p className="text-sm text-gray-600">Procesa un pedido para ver aquí el listado de productos y cantidades.</p>
          )}
          {quickItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleToggleQuickItem(item.id)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                item.selected ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={item.selected} readOnly className="h-4 w-4" />
                <span className="font-semibold text-gray-900">{item.productName}</span>
              </div>
              <span className="text-sm font-semibold text-gray-700">{item.units} ud</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
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
                    Selecciona productos en la vista rápida para revisarlos y generar etiquetas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Revisa antes de generar</p>
          <p className="text-xs text-gray-600">
            Usa el botón “Revisar y generar” en cada línea para abrir la pantalla de datos editables con los campos
            pre-rellenos. La generación y guardado se harán allí.
          </p>
        </div>
      </section>
    </div>
  )
}
