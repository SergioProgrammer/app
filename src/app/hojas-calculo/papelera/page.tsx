'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TrashBin } from '@/client/spreadsheets/components/TrashBin'

export default function PapeleraPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/hojas-calculo"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a hojas de cálculo
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Papelera</h1>
        <p className="text-sm text-gray-600">
          Hojas archivadas. Puedes restaurarlas o eliminarlas permanentemente.
        </p>
      </div>
      <TrashBin />
    </div>
  )
}
