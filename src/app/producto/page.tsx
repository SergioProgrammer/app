'use client'

import { useEffect, useMemo, useState } from 'react'
import PanelLayout from '@/components/panel-layout'
import { CheckCircle2 } from 'lucide-react'
import {
  DEFAULT_LABEL_TYPE,
  LABEL_TYPE_OPTIONS,
  LABEL_TYPE_PRODUCTS,
  PRODUCT_SELECTION_STORAGE_KEY,
  type LabelType,
  parseStoredProductSelection,
  getLabelTypeLabel,
} from '@/lib/product-selection'

const labelTypeOrder: LabelType[] = [
  'mercadona',
  'aldi',
  'lidl',
  'hiperdino',
  'kanali',
  'blanca-grande',
  'blanca-pequena',
]

export default function ProductoPage() {
  const [labelType, setLabelType] = useState<LabelType>(DEFAULT_LABEL_TYPE)
  const [productName, setProductName] = useState(LABEL_TYPE_PRODUCTS[DEFAULT_LABEL_TYPE][0])
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = parseStoredProductSelection(window.localStorage.getItem(PRODUCT_SELECTION_STORAGE_KEY))
      if (stored) {
        setLabelType(stored.labelType)
        setProductName(stored.productName)
        setSavedAt(stored.savedAt ?? null)
      }
    } catch {
      // ignore malformed values
    }
  }, [])

  useEffect(() => {
    setProductName((current) => {
      const options = LABEL_TYPE_PRODUCTS[labelType]
      if (options.includes(current)) {
        return current
      }
      return options[0]
    })
  }, [labelType])

  const formattedSavedAt = useMemo(() => {
    if (!savedAt) return null
    try {
      return new Date(savedAt).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return null
    }
  }, [savedAt])

  const handleSave = () => {
    if (typeof window === 'undefined') return
    const payload = {
      labelType,
      productName,
      savedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(PRODUCT_SELECTION_STORAGE_KEY, JSON.stringify(payload))
    setSavedAt(payload.savedAt)
    setStatus('saved')
    window.setTimeout(() => setStatus('idle'), 2000)
  }

  const availableProducts = LABEL_TYPE_PRODUCTS[labelType]

  return (
    <PanelLayout>
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Productos</p>
              <h1 className="text-2xl font-semibold text-gray-900">Selecciona el producto</h1>
              <p className="text-sm text-gray-600">
                Define si el pedido es para Mercadona o Aldi (pequeño o grande) y qué producto vamos a etiquetar. Dejamos
                Albahaca como valor predeterminado para esta pestaña.
              </p>
            </header>
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-sm font-semibold text-gray-900">Tipo de etiqueta</p>
                <p className="text-sm text-gray-600">
                  Selecciona si corresponde a Mercadona, Aldi o un formato blanco.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {labelTypeOrder.map((type) => {
                    const option = LABEL_TYPE_OPTIONS[type]
                    const isActive = labelType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLabelType(type)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="mt-1 text-xs text-gray-500">{option.description}</p>
                        {option.helper && (
                          <p className="mt-2 text-xs font-medium text-emerald-700">{option.helper}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Producto</p>
                <p className="text-sm text-gray-600">
                  {labelType === 'mercadona'
                    ? 'Mercadona solo usa Albahaca en esta etiqueta.'
                    : 'Selecciona entre las opciones disponibles para este formato.'}
                </p>
                <div
                  className={`mt-4 grid gap-3 ${
                    availableProducts.length > 1 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
                  }`}
                >
                  {availableProducts.map((option) => {
                    const isActive = productName === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setProductName(option)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-semibold">{option}</p>
                        {labelType !== 'mercadona' && (
                          <p className="mt-1 text-xs text-gray-500">
                            Disponible para {getLabelTypeLabel(labelType).toLowerCase()}.
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Guardar selección
                </button>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  {status === 'saved' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Selección guardada</span>
                    </>
                  ) : formattedSavedAt ? (
                    <span>Última actualización: {formattedSavedAt}</span>
                  ) : (
                    <span>Aún no se ha guardado ninguna selección.</span>
                  )}
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-3xl border border-dashed border-gray-300 bg-[#FAF9F6] p-6 sm:p-7">
            <p className="text-sm font-semibold text-gray-900">Cómo se usa</p>
            <p className="mt-2 text-sm text-gray-600">
              Guardamos esta información en tu navegador y la mostramos en el resumen del formulario de generación de
              etiquetas para que el almacén sepa qué producto se está imprimiendo.
            </p>
          </section>
        </div>
      </main>
    </PanelLayout>
  )
}
