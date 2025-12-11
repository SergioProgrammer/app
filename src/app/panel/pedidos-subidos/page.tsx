'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PanelLayout from '@/components/panel-layout'
import { createClient } from '@/utils/supabase/client'

interface PedidoSubido {
  id?: string | null
  name?: string
  path: string
  bucket?: string | null
  status?: string | null
  estado?: string | null
  client?: string | null
  cliente?: string | null
  destino?: string | null
  created_at?: string | null
  uploaded_at?: string | null
  uploadedAt?: string | null
  originalName?: string | null
  original_name?: string | null
  nombre_archivo?: string | null
  archivo?: string | null
  webViewLink?: string | null
  webContentLink?: string | null
}

type PedidoRow = PedidoSubido & {
  estado: string
  fecha: string
  displayClient: string
  displayName: string
  uploadedAt: string | null
}

function normalizeEstado(value?: string | null): string {
  if (!value) return 'Pendiente'
  const normalized = value.trim()
  if (!normalized) return 'Pendiente'
  const lower = normalized.toLowerCase()
  if (lower === 'pendiente') return 'Pendiente'
  if (lower === 'procesado' || lower === 'procesada') return 'Procesado'
  return normalized
}

function normalizePedidoRow(pedido: PedidoSubido): PedidoRow {
  const estado = normalizeEstado(pedido.estado ?? pedido.status)
  const uploadedAt = pedido.uploadedAt ?? pedido.uploaded_at ?? pedido.created_at ?? null
  const client = pedido.client ?? pedido.cliente ?? pedido.destino ?? ''
  const basePath = pedido.path || ''
  const displayName =
    pedido.originalName ??
    pedido.original_name ??
    pedido.nombre_archivo ??
    pedido.archivo ??
    pedido.name ??
    (basePath ? basePath.split('/').pop() ?? basePath : '') ??
    basePath
  return {
    ...pedido,
    estado,
    status: estado,
    client,
    uploadedAt,
    fecha: uploadedAt ? new Date(uploadedAt).toLocaleString() : '-',
    displayClient: client || '—',
    displayName,
  }
}

export default function PedidosSubidosPage() {
  const supabase = useMemo(() => createClient(), [])
  const [pedidos, setPedidos] = useState<PedidoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadPedidos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/pedidos-subidos', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('No se pudieron cargar los pedidos subidos.')
      }
      const payload = (await response.json()) as { files?: PedidoSubido[] }
      const normalized = (payload.files ?? []).map((pedido) => normalizePedidoRow(pedido))
      setPedidos(normalized)
      setSelected({})
    } catch (err) {
      setError('No se pudieron cargar los pedidos subidos.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPedidos()
  }, [loadPedidos])

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/pedidos-subidos', {
          method: 'POST',
          body: formData,
        })
        if (!response.ok) {
          throw new Error('No se pudo subir el pedido.')
        }
        const payload = (await response.json()) as { file: PedidoSubido }
        const normalized = normalizePedidoRow(payload.file)
        setPedidos((current) => [normalized, ...current])
      } catch (err) {
        setError('No se pudo subir el pedido.')
        console.error(err)
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        void handleUpload(file)
      }
    },
    [handleUpload],
  )

  const handleProcesar = useCallback(
    async (pedido: PedidoRow) => {
      if (!pedido.path) return
      const identifier = pedido.id ?? pedido.path
      const params = new URLSearchParams()
      params.set('pedidoPath', pedido.path)
      if (pedido.id) params.set('pedidoId', pedido.id)
      if (pedido.client) params.set('client', pedido.client)
      const targetUrl = `/pedidos-vision?${params.toString()}`

      setProcessingId(identifier)
      setError(null)
      try {
        const targetEstado = 'Procesado'
        const update = supabase.from('pedidos_subidos').update({ estado: targetEstado })
        const { error: updateError } = pedido.id ? await update.eq('id', pedido.id) : await update.eq('path', pedido.path)
        if (updateError) {
          console.error(updateError)
          setError('No se pudo actualizar el estado del pedido.')
        } else {
          setPedidos((current) =>
            current.map((item) =>
              (pedido.id && item.id === pedido.id) || (!pedido.id && item.path === pedido.path)
                ? { ...item, estado: targetEstado, status: targetEstado }
                : item,
            ),
          )
        }
      } catch (err) {
        console.error(err)
        setError('No se pudo actualizar el estado del pedido.')
      } finally {
        setProcessingId(null)
        window.location.href = targetUrl
      }
    },
    [supabase],
  )

  const rows = useMemo(() => pedidos, [pedidos])

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const areAllSelected = useMemo(() => {
    if (rows.length === 0) return false
    return rows.every((pedido) => selected[pedido.id ?? pedido.path])
  }, [rows, selected])

  const toggleSelectAll = useCallback(() => {
    if (rows.length === 0) return
    const next: Record<string, boolean> = {}
    const shouldSelectAll = !areAllSelected
    rows.forEach((pedido) => {
      const key = pedido.id ?? pedido.path
      if (key) next[key] = shouldSelectAll
    })
    setSelected(next)
  }, [areAllSelected, rows])

  const handleDelete = useCallback(
    async (paths: string[]) => {
      setDeleting(true)
      setError(null)
      try {
        const response = await fetch('/api/pedidos-subidos', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths }),
        })
        if (!response.ok) {
          throw new Error('No se pudieron eliminar los pedidos seleccionados.')
        }
        setPedidos((current) => current.filter((pedido) => !paths.includes(pedido.path)))
        setSelected({})
      } catch (err) {
        setError('No se pudieron eliminar los pedidos seleccionados.')
        console.error(err)
      } finally {
        setDeleting(false)
      }
    },
    [],
  )

  const handleDeleteSelected = useCallback(() => {
    const paths = rows
      .filter((pedido) => selected[pedido.id ?? pedido.path])
      .map((pedido) => pedido.path)
      .filter(Boolean)
    if (paths.length === 0) return
    const confirmed = window.confirm(`¿Eliminar ${paths.length} pedidos seleccionados?`)
    if (!confirmed) return
    void handleDelete(paths)
  }, [handleDelete, rows, selected])

  const handleDeleteAll = useCallback(() => {
    if (rows.length === 0) return
    const confirmed = window.confirm('¿Eliminar todos los pedidos del historial?')
    if (!confirmed) return
    const allPaths = rows.map((pedido) => pedido.path).filter(Boolean)
    void handleDelete(allPaths)
  }, [handleDelete, rows])

  return (
    <PanelLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Pedidos subidos</h1>
            <p className="text-sm text-gray-600">Gestiona los pedidos que llegan a logística.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Eliminar seleccionados
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={deleting || rows.length === 0}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Eliminar todo
            </button>
            <label className="inline-flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 cursor-pointer">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.xlsm,.csv,.tsv,.ods"
                className="hidden"
                onChange={handleFileChange}
              />
              {uploading ? 'Subiendo…' : 'Subir pedido'}
            </label>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                  <input type="checkbox" checked={areAllSelected} onChange={toggleSelectAll} />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">ID</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Cliente / destino</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Archivo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">
                    Cargando pedidos...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">
                    No hay pedidos subidos todavía.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((pedido) => (
                  <tr key={pedido.id ?? pedido.path}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[pedido.id ?? pedido.path])}
                        onChange={() => toggleSelected(pedido.id ?? pedido.path)}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{pedido.id ?? '—'}</td>
                    <td className="px-3 py-2">{pedido.fecha}</td>
                    <td className="px-3 py-2">{pedido.displayClient}</td>
                    <td className="px-3 py-2">{pedido.displayName}</td>
                    <td className="px-3 py-2 capitalize">{pedido.estado}</td>
                    <td className="px-3 py-2 space-x-2">
                      <a
                        href={`/api/pedidos-subidos/file?path=${encodeURIComponent(pedido.path)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 hover:text-emerald-900 font-semibold"
                      >
                        Ver original
                      </a>
                      <button
                        type="button"
                        className="text-sm font-semibold text-gray-900 underline hover:text-black disabled:opacity-50"
                        onClick={() => handleProcesar(pedido)}
                        disabled={processingId === (pedido.id ?? pedido.path)}
                      >
                        {processingId === (pedido.id ?? pedido.path) ? 'Actualizando…' : 'Procesar'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </PanelLayout>
  )
}
