'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PanelLayout from '@/components/panel-layout'

type InventoryItem = {
  id: string
  product_name: string
  units_available: number
  created_at?: string | null
  updated_at?: string | null
}

export default function StockPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/stock')
      if (!response.ok) {
        throw new Error('No se pudo cargar el inventario.')
      }
      const payload = (await response.json()) as { items?: InventoryItem[] }
      setItems(payload.items ?? [])
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar el inventario.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleChange = useCallback((id: string, value: string) => {
    setEditing((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleAdjust = useCallback(
    async (item: InventoryItem, mode: 'add' | 'set') => {
      const raw = editing[item.id] ?? ''
      const value = Number.parseInt(raw, 10)
      if (!Number.isFinite(value)) {
        setError('Introduce un número válido.')
        return
      }
      setSaving(true)
      setError(null)
      try {
        const body =
          mode === 'add'
            ? { productName: item.product_name, delta: value }
            : { productName: item.product_name, setTo: value }
        const response = await fetch('/api/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          throw new Error('No se pudo actualizar el stock.')
        }
        const payload = (await response.json()) as { item?: InventoryItem }
        if (payload.item) {
          setItems((current) =>
            current.map((row) => (row.id === payload.item?.id ? payload.item : row)),
          )
          setEditing((prev) => ({ ...prev, [item.id]: '' }))
        }
      } catch (err) {
        console.error(err)
        setError('No se pudo actualizar el stock.')
      } finally {
        setSaving(false)
      }
    },
    [editing],
  )

  const rows = useMemo(
    () => {
      const filtered = items.filter((item) =>
        item.product_name.toLowerCase().includes(search.trim().toLowerCase()),
      )
      return filtered.map((item) => ({
        ...item,
        updatedLabel: item.updated_at
          ? new Date(item.updated_at).toLocaleString()
          : item.created_at
          ? new Date(item.created_at).toLocaleString()
          : '—',
      }))
    },
    [items, search],
  )

  return (
    <PanelLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Stock</h1>
            <p className="text-sm text-gray-600">
              Control de inventario por producto. Los productos nuevos arrancan con 1000 unidades.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto"
              className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
              disabled={loading}
            >
              Actualizar
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Producto</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Stock</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Última actualización</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">
                    Cargando inventario…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">
                    No hay productos aún. Se crearán automáticamente al procesar un pedido.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-semibold text-gray-900">{item.product_name}</td>
                    <td className="px-3 py-2">{item.units_available}</td>
                    <td className="px-3 py-2 text-gray-600">{item.updatedLabel}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={editing[item.id] ?? ''}
                          onChange={(e) => handleChange(item.id, e.target.value)}
                          placeholder="Unidades"
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleAdjust(item, 'add')}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Añadir stock
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleAdjust(item, 'set')}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Sobrescribir
                        </button>
                      </div>
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
