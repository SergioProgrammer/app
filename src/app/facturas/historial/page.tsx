'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2, RefreshCcw, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

type InvoiceRecord = {
  id: string
  invoice_number: string
  date: string
  customer_name: string
  customer_tax_id: string | null
  total: number | null
  currency: string | null
  file_path: string | null
  anexo_path?: string | null
  created_at: string | null
}

export default function FacturasHistorialPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<InvoiceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const fetchRows = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('facturas')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setRows(data ?? [])
      setSelected(new Set())
    } catch (err) {
      console.error('[historial facturas] fetch error', err)
      const message =
        err instanceof Error
          ? `No se pudo cargar el historial de facturas: ${err.message}`
          : 'No se pudo cargar el historial de facturas.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRows()
  }, [])

  const openFromStorage = async (path: string, id: string, label: string, bucket = 'facturas') => {
    if (!path) return
    setDownloadingId(`${id}:${label}`)
    try {
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
      let url = publicData?.publicUrl ?? null
      if (!url) {
        const { data: signedData, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
        if (signedError) throw signedError
        url = signedData?.signedUrl ?? null
      }
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setError('No se pudo obtener el enlace de descarga.')
      }
    } catch (err) {
      console.error(err)
      setError('No se pudo descargar el archivo solicitado.')
    } finally {
      setDownloadingId(null)
    }
  }

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === rows.length) return new Set()
      return new Set(rows.map((r) => r.id))
    })
  }

  const deleteSelected = async () => {
    if (selected.size === 0) return
    setDeleting(true)
    try {
      const ids = Array.from(selected)
      const targets = rows.filter((r) => ids.includes(r.id))

      // Delete DB rows
      const { error: deleteError } = await supabase.from('facturas').delete().in('id', ids)
      if (deleteError) throw deleteError

      // Delete storage files (best-effort)
      const facturaPaths = targets.map((r) => r.file_path).filter(Boolean) as string[]
      const anexoPaths = targets.map((r) => r.anexo_path).filter(Boolean) as string[]
      if (facturaPaths.length > 0) {
        await supabase.storage.from('facturas').remove(facturaPaths)
      }
      if (anexoPaths.length > 0) {
        await supabase.storage.from('informe').remove(anexoPaths)
      }

      setRows((prev) => prev.filter((r) => !selected.has(r.id)))
      setSelected(new Set())
    } catch (err) {
      console.error('[historial facturas] delete error', err)
      setError('No se pudieron eliminar algunas facturas.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-gray-500">Facturación</p>
          <h1 className="text-2xl font-semibold text-gray-900">Historial de facturas</h1>
          <p className="text-sm text-gray-600">Consulta facturas previas y descárgalas desde Supabase.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/facturas/nueva"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Nueva factura
          </Link>
          <button
            type="button"
            onClick={() => void fetchRows()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refrescar
          </button>
          <button
            type="button"
            onClick={() => void deleteSelected()}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            disabled={selected.size === 0 || deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Eliminar seleccionadas
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
          <p>{error}</p>
          <p className="text-xs text-amber-700">
            Si la tabla <code>facturas</code> no existe, aplica la migración incluida en <code>supabase/migrations</code>. Verifica también las políticas RLS de select/insert para el rol authenticated.
          </p>
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todas"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Número</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Cliente</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">CIF/NIF</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  {loading ? 'Cargando…' : 'No hay facturas registradas.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${row.invoice_number}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelected(row.id)}
                    />
                  </td>
                  <td className="px-3 py-2">{row.invoice_number}</td>
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{row.customer_name}</td>
                  <td className="px-3 py-2">{row.customer_tax_id ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {row.total != null
                      ? `${row.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${row.currency ?? 'EUR'}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.file_path ? (
                        <button
                          type="button"
                          onClick={() => void openFromStorage(row.file_path!, row.id, 'factura', 'facturas')}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                          disabled={downloadingId === `${row.id}:factura`}
                        >
                          {downloadingId === `${row.id}:factura` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Factura
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">Sin factura</span>
                      )}
                      {row.anexo_path ? (
                        <button
                          type="button"
                          onClick={() => void openFromStorage(row.anexo_path!, row.id, 'anexo', 'informe')}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                          disabled={downloadingId === `${row.id}:anexo`}
                        >
                          {downloadingId === `${row.id}:anexo` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Anexo IV
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">Sin anexo</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
