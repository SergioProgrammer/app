'use client'

import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import type { DayOfWeek, SpreadsheetListItem } from '../types'
import { useSpreadsheetList } from '../hooks/useSpreadsheetList'
import { createSpreadsheet } from '../services/spreadsheetApi'
import { SpreadsheetCard } from './SpreadsheetCard'

const DAY_COLUMNS: { key: DayOfWeek; label: string }[] = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'sabado', label: 'Sábado' },
]

function formatDefaultName(day: DayOfWeek): string {
  const labels: Record<DayOfWeek, string> = { lunes: 'Lunes', martes: 'Martes', sabado: 'Sábado' }
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return `${labels[day]} ${dd}/${mm}/${yyyy}`
}

interface CreateModalProps {
  initialDay?: DayOfWeek
  hasPreviousForDay: (day: DayOfWeek) => boolean
  onClose: () => void
  onCreated: (id: string) => void
}

function CreateModal({ initialDay, hasPreviousForDay, onClose, onCreated }: CreateModalProps) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | undefined>(initialDay)
  const [name, setName] = useState(initialDay ? formatDefaultName(initialDay) : '')
  const [copyFromPrevious, setCopyFromPrevious] = useState(true)
  const [creating, setCreating] = useState(false)

  const handleDayChange = (day: DayOfWeek) => {
    setSelectedDay(day)
    setName(formatDefaultName(day))
    setCopyFromPrevious(hasPreviousForDay(day))
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const result = await createSpreadsheet(name || 'Sin nombre', {
        dayOfWeek: selectedDay,
        copyFromPrevious: selectedDay ? copyFromPrevious : false,
      })
      onCreated(result.id)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nueva hoja de cálculo</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Día de envío</label>
            <div className="flex gap-2">
              {DAY_COLUMNS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => handleDayChange(d.key)}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    selectedDay === d.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la hoja"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
            />
          </div>

          {selectedDay && hasPreviousForDay(selectedDay) && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={copyFromPrevious}
                onChange={(e) => setCopyFromPrevious(e.target.checked)}
                className="rounded border-gray-300"
              />
              Partir de hoja anterior
            </label>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              'Crear'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DayColumnProps {
  day: { key: DayOfWeek; label: string }
  spreadsheets: SpreadsheetListItem[]
  onClickCard: (id: string) => void
  onArchive: (id: string) => void
  onCreateForDay: (day: DayOfWeek) => void
}

function DayColumn({ day, spreadsheets, onClickCard, onArchive, onCreateForDay }: DayColumnProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-sm font-semibold text-gray-900 lg:cursor-default"
        >
          {day.label}
          <span className="text-xs font-normal text-gray-400">({spreadsheets.length})</span>
          <span className="lg:hidden">
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </span>
        </button>
        <button
          onClick={() => onCreateForDay(day.key)}
          className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-100 transition-colors"
          title={`Crear hoja para ${day.label}`}
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva
        </button>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-2">
          {spreadsheets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
              Sin hojas
            </div>
          ) : (
            spreadsheets.map((s) => (
              <SpreadsheetCard
                key={s.id}
                spreadsheet={s}
                onClick={() => onClickCard(s.id)}
                onArchive={onArchive}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function SpreadsheetList() {
  const { spreadsheets, loading, error, archive } = useSpreadsheetList({ mode: 'active' })
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDay, setModalDay] = useState<DayOfWeek | undefined>()

  const grouped = useMemo(() => {
    const groups: Record<DayOfWeek | 'unclassified', SpreadsheetListItem[]> = {
      lunes: [],
      martes: [],
      sabado: [],
      unclassified: [],
    }
    spreadsheets.forEach((s) => {
      const key = s.dayOfWeek ?? 'unclassified'
      groups[key].push(s)
    })
    return groups
  }, [spreadsheets])

  const hasPreviousForDay = useCallback(
    (day: DayOfWeek) => grouped[day].length > 0,
    [grouped],
  )

  const openModal = (day?: DayOfWeek) => {
    setModalDay(day)
    setModalOpen(true)
  }

  const handleCreated = (id: string) => {
    setModalOpen(false)
    router.push(`/hojas-calculo/${id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/hojas-calculo/papelera"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Ver papelera
          </Link>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Crear nueva
        </button>
      </div>

      {spreadsheets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-500">No hay hojas de cálculo todavía.</p>
          <button
            onClick={() => openModal()}
            className="mt-2 inline-block text-sm font-medium text-gray-900 underline"
          >
            Crear la primera
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {DAY_COLUMNS.map((day) => (
              <DayColumn
                key={day.key}
                day={day}
                spreadsheets={grouped[day.key]}
                onClickCard={(id) => router.push(`/hojas-calculo/${id}`)}
                onArchive={archive}
                onCreateForDay={(d) => openModal(d)}
              />
            ))}
          </div>

          {grouped.unclassified.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-gray-500">Sin clasificar</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.unclassified.map((s) => (
                  <SpreadsheetCard
                    key={s.id}
                    spreadsheet={s}
                    onClick={() => router.push(`/hojas-calculo/${s.id}`)}
                    onArchive={archive}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <CreateModal
          initialDay={modalDay}
          hasPreviousForDay={hasPreviousForDay}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
