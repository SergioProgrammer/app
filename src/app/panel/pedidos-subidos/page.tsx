'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PanelLayout from '@/components/panel-layout'

interface PedidoSubido {
  id?: string | null
  name: string
  path: string
  bucket?: string | null
  status: string
  client: string
  uploadedAt: string | null
  originalName: string
  webViewLink?: string | null
  webContentLink?: string | null
}

export default function PedidosSubidosPage() {
  const [pedidos, setPedidos] = useState<PedidoSubido[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState(false)

  const loadPedidos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/pedidos-subidos')
      if (!response.ok) {
        throw new Error('No se pudieron cargar los pedidos subidos.')
      }
      const payload = (await response.json()) as { files?: PedidoSubido[] }
      setPedidos(payload.files ?? [])
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
        setPedidos((current) => [payload.file, ...current])
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

  const handleProcesar = useCallback((pedido: PedidoSubido) => {
    const target = `/pedidos-vision?pedidoPath=${encodeURIComponent(pedido.path)}&client=${encodeURIComponent(
      pedido.client || '',
    )}`
    window.location.href = target
  }, [])

  const rows = useMemo(
    () =>
      pedidos.map((pedido) => ({
        ...pedido,
        fecha: pedido.uploadedAt ? new Date(pedido.uploadedAt).toLocaleString() : '-',
        estado: pedido.status || 'pendiente',
      })),
    [pedidos],
  )

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
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
                    Cargando pedidos...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
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
                    <td className="px-3 py-2">{pedido.fecha}</td>
                    <td className="px-3 py-2">{pedido.client || '—'}</td>
                    <td className="px-3 py-2">{pedido.originalName || pedido.name}</td>
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
                        className="text-sm font-semibold text-gray-900 underline hover:text-black"
                        onClick={() => handleProcesar(pedido)}
                      >
                        Procesar
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
