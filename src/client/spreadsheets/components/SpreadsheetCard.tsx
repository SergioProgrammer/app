'use client'

import { Archive, MoreVertical } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpreadsheetListItem } from '../types'

interface SpreadsheetCardProps {
  spreadsheet: SpreadsheetListItem
  onClick: () => void
  onArchive: (id: string) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

export function SpreadsheetCard({ spreadsheet, onClick, onArchive }: SpreadsheetCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleArchive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setMenuOpen(false)
      onArchive(spreadsheet.id)
    },
    [onArchive, spreadsheet.id],
  )

  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">{spreadsheet.name}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {spreadsheet.rowCount} {spreadsheet.rowCount === 1 ? 'fila' : 'filas'}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{timeAgo(spreadsheet.updatedAt)}</p>
        </div>
        <div ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-4 top-12 z-10 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={handleArchive}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Archive className="h-3.5 w-3.5" />
                Archivar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
