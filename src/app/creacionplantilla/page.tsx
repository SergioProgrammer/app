'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react'
import { Download, Copy, PlusCircle, MousePointer2, RotateCcw } from 'lucide-react'

type FieldKey = 'fechaEnvasado' | 'lote' | 'labelCode' | 'codigoCoc' | 'codigoR' | 'weight'

interface FieldConfig {
  key: FieldKey
  label: string
  sample: string
}

const FIELD_DEFINITIONS: FieldConfig[] = [
  { key: 'fechaEnvasado', label: 'Fecha de envasado', sample: 'Envasado 14.10.24' },
  { key: 'lote', label: 'Lote', sample: 'LOTE 20241014-01' },
  { key: 'labelCode', label: 'Código de barras', sample: '8437000000000' },
  { key: 'codigoCoc', label: 'Código COC', sample: 'COC 123456' },
  { key: 'codigoR', label: 'Código R', sample: 'R-ES-1234' },
  { key: 'weight', label: 'Peso mostrado', sample: '40 gr' },
]

const TEXT_FIELD_KEYS: FieldKey[] = FIELD_DEFINITIONS.map((field) => field.key).filter(
  (key): key is Exclude<FieldKey, 'weight'> => key !== 'weight',
)

type AlignMode = 'left' | 'center' | 'right'

interface FieldBox {
  key: FieldKey
  x: number
  y: number
  width: number
  height: number
  align: AlignMode
  fontSize: number
  baseline: number
  sample: string
}

interface DrawingState {
  field: FieldKey
  startX: number
  startY: number
}

export default function CreacionPlantillaPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageNaturalWidth, setImageNaturalWidth] = useState<number | null>(null)
  const [imageNaturalHeight, setImageNaturalHeight] = useState<number | null>(null)
  const [imageDisplayWidth, setImageDisplayWidth] = useState<number | null>(null)
  const [activeField, setActiveField] = useState<FieldKey>('fechaEnvasado')
  const [drawingField, setDrawingField] = useState<FieldKey | null>(null)
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null)
  const [dragState, setDragState] = useState<{ field: FieldKey; offsetX: number; offsetY: number } | null>(null)
  const [fields, setFields] = useState<Record<FieldKey, FieldBox>>(() => {
    const initialBoxes: Record<FieldKey, FieldBox> = FIELD_DEFINITIONS.reduce(
      (accumulator, field) => {
        accumulator[field.key] = {
          key: field.key,
          x: 100,
          y: 100,
          width: 260,
          height: 56,
          align: 'left',
          fontSize: 36,
          baseline: 0.75,
          sample: field.sample,
        }
        return accumulator
      },
      {} as Record<FieldKey, FieldBox>,
    )
    return initialBoxes
  })
  const imageRef = useRef<HTMLImageElement | null>(null)

  const scale = useMemo(() => {
    if (!imageNaturalWidth || !imageDisplayWidth) return 1
    return imageDisplayWidth / imageNaturalWidth
  }, [imageDisplayWidth, imageNaturalWidth])

  useEffect(() => {
    if (!imageRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === imageRef.current) {
          setImageDisplayWidth(entry.contentRect.width)
        }
      }
    })
    observer.observe(imageRef.current)
    return () => observer.disconnect()
  }, [imageSrc])

  const resetState = useCallback(() => {
    setFields(
      FIELD_DEFINITIONS.reduce((accumulator, field) => {
        accumulator[field.key] = {
          key: field.key,
          x: 100,
          y: 100 + FIELD_DEFINITIONS.findIndex((definition) => definition.key === field.key) * 70,
          width: 260,
          height: 56,
          align: 'left',
          fontSize: 36,
          baseline: 0.75,
          sample: field.sample,
        }
        return accumulator
      }, {} as Record<FieldKey, FieldBox>),
    )
    setActiveField('fechaEnvasado')
    setDrawingField(null)
    setDrawingState(null)
    setDragState(null)
  }, [])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const image = new Image()
        image.onload = () => {
          setImageNaturalWidth(image.naturalWidth)
          setImageNaturalHeight(image.naturalHeight)
          setImageSrc(reader.result as string)
          resetState()
        }
        image.src = reader.result
      }
    }
    reader.readAsDataURL(file)
  }, [resetState])

  const mutateField = useCallback(
    (fieldKey: FieldKey, updater: (current: FieldBox) => FieldBox) => {
      setFields((current) => ({
        ...current,
        [fieldKey]: updater(current[fieldKey]),
      }))
    },
    [],
  )

  const getPointerPosition = useCallback(
    (event: MouseEvent<HTMLDivElement>, options?: { allowOutside?: boolean }) => {
      if (!imageRef.current || !imageNaturalWidth || !imageNaturalHeight) return null
      const rect = imageRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      const rawX = ((event.clientX - rect.left) / rect.width) * imageNaturalWidth
      const rawY = ((event.clientY - rect.top) / rect.height) * imageNaturalHeight
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      if (!inside && !options?.allowOutside) return null
      const x = Math.min(Math.max(rawX, 0), imageNaturalWidth)
      const y = Math.min(Math.max(rawY, 0), imageNaturalHeight)
      return { x, y }
    },
    [imageNaturalHeight, imageNaturalWidth],
  )

  const handlePointerDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const position = getPointerPosition(event)
      if (!position) return
      event.preventDefault()

      if (drawingField) {
        setDrawingState({ field: drawingField, startX: position.x, startY: position.y })
        mutateField(drawingField, (current) => ({
          ...current,
          x: position.x,
          y: position.y,
          width: 1,
          height: 1,
        }))
        return
      }

      const fieldsInOrder = [...FIELD_DEFINITIONS.map((field) => field.key)].reverse()
      const hitKey = fieldsInOrder.find((key) => {
        const box = fields[key]
        return (
          position.x >= box.x &&
          position.x <= box.x + box.width &&
          position.y >= box.y &&
          position.y <= box.y + box.height
        )
      })

      if (hitKey) {
        setActiveField(hitKey)
        setDragState({
          field: hitKey,
          offsetX: position.x - fields[hitKey].x,
          offsetY: position.y - fields[hitKey].y,
        })
      }
    },
    [drawingField, fields, getPointerPosition, mutateField],
  )

  const handlePointerMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (dragState) {
        const position = getPointerPosition(event, { allowOutside: true })
        if (!position) return
        mutateField(dragState.field, (current) => {
          const maxX = (imageNaturalWidth ?? current.width) - current.width
          const maxY = (imageNaturalHeight ?? current.height) - current.height
          const nextX = Math.min(Math.max(position.x - dragState.offsetX, 0), Math.max(maxX, 0))
          const nextY = Math.min(Math.max(position.y - dragState.offsetY, 0), Math.max(maxY, 0))
          return {
            ...current,
            x: nextX,
            y: nextY,
          }
        })
        return
      }

      if (!drawingState) return
      const position = getPointerPosition(event, { allowOutside: true })
      if (!position) return
      const width = Math.abs(position.x - drawingState.startX)
      const height = Math.abs(position.y - drawingState.startY)
      const x = Math.min(position.x, drawingState.startX)
      const y = Math.min(position.y, drawingState.startY)
      mutateField(drawingState.field, (current) => ({
        ...current,
        x,
        y,
        width,
        height,
      }))
    },
    [dragState, drawingState, getPointerPosition, imageNaturalHeight, imageNaturalWidth, mutateField],
  )

  const handlePointerUp = useCallback(() => {
    if (drawingState) {
      setActiveField(drawingState.field)
      setDrawingField(null)
      setDrawingState(null)
    }
    if (dragState) {
      setDragState(null)
    }
  }, [dragState, drawingState])

  useEffect(() => {
    const handler = () => {
      setDrawingField(null)
      setDrawingState(null)
      setDragState(null)
    }
    window.addEventListener('mouseup', handler)
    window.addEventListener('mouseleave', handler)
    return () => {
      window.removeEventListener('mouseup', handler)
      window.removeEventListener('mouseleave', handler)
    }
  }, [])

  const layoutSnippet = useMemo(() => {
    if (!imageNaturalHeight) return ''

    const textLines = TEXT_FIELD_KEYS.map((key) => {
      const field = fields[key]
      const baselineY = field.y + field.height * field.baseline
      const baseY = Math.round(imageNaturalHeight - baselineY)
      const baseX = Math.round(field.x)
      const fontSize = Math.round(field.fontSize)
      return `  ${key}: { baseX: ${baseX}, baseY: ${baseY}, align: '${field.align}', fontSize: ${fontSize} }`
    })

    const weightField = fields.weight
    const weightBaseline = weightField.y + weightField.height * weightField.baseline
    const weightBaseY = Math.round(imageNaturalHeight - weightBaseline)
    const weightBaseX = Math.round(weightField.x)
    const weightFontSize = Math.round(weightField.fontSize)

    return (
      `const TEXT_LAYOUT = {\n${textLines.join(',\n')}\n}` +
      `\n\nconst WEIGHT_LAYOUT = { baseX: ${weightBaseX}, baseY: ${weightBaseY}, align: '${weightField.align}', fontSize: ${weightFontSize} }`
    )
  }, [fields, imageNaturalHeight])

  const rawDataSnippet = useMemo(() => {
    const lines = FIELD_DEFINITIONS.map(({ key }) => {
      const field = fields[key]
      return `  ${key}: { x: ${Math.round(field.x)}, y: ${Math.round(field.y)}, width: ${Math.round(field.width)}, height: ${Math.round(field.height)}, baseline: ${Math.round(field.baseline * 100) / 100}, align: '${field.align}', fontSize: ${Math.round(field.fontSize)} }`
    })
    return `{\n${lines.join(',\n')}\n}`
  }, [fields])

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copiado al portapapeles')
    } catch (error) {
      console.error('No se pudo copiar al portapapeles', error)
    }
  }, [])

  const handleDownload = useCallback(() => {
    const payload = {
      image: {
        width: imageNaturalWidth,
        height: imageNaturalHeight,
        source: imageSrc,
      },
      fields,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `plantilla-label-${Date.now().toString(36)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [fields, imageNaturalHeight, imageNaturalWidth, imageSrc])

  const handleBoxInputChange = useCallback(
    (fieldKey: FieldKey, property: keyof FieldBox, value: number | AlignMode | string) => {
      mutateField(fieldKey, (current) => ({
        ...current,
        [property]: value,
      }))
    },
    [mutateField],
  )

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Creador de plantillas</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Sube la imagen base de la etiqueta, marca las zonas de cada texto y copia el layout
              generado para el renderizador. Ajusta la baseline si el texto queda demasiado alto o
              bajo dentro del recuadro.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400">
              <PlusCircle className="h-4 w-4 text-gray-500" />
              Subir imagen
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
            <button
              type="button"
              onClick={resetState}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <RotateCcw className="h-4 w-4 text-gray-500" />
              Reiniciar campos
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!imageSrc}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-gray-500" />
              Guardar JSON
            </button>
          </div>
        </header>

        {!imageSrc ? (
          <section className="flex h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white">
            <p className="text-sm text-gray-600">
              Sube la imagen con la etiqueta en blanco para empezar a marcar campos.
            </p>
          </section>
        ) : (
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div
              className="relative w-full rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                  <MousePointer2 className="h-3.5 w-3.5" />
                  {drawingField
                    ? `Dibuja el área para ${fields[drawingField].sample}`
                    : `Selección activa: ${fields[activeField].sample} (arrastra para mover)`}
                </div>
                {imageNaturalWidth && imageNaturalHeight && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                    Tamaño base: {imageNaturalWidth}×{imageNaturalHeight}px
                  </span>
                )}
              </div>

              <div className="relative mx-auto w-full overflow-hidden rounded-2xl border border-gray-200 bg-[#111]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imageRef}
                  src={imageSrc ?? ''}
                  alt="Plantilla base"
                  className="h-auto w-full select-none"
                  draggable={false}
                />

                {FIELD_DEFINITIONS.map(({ key }) => {
                  const field = fields[key]
                  const isActive = key === activeField
                  const displayLeft = field.x * scale
                  const displayTop = field.y * scale
                  const displayWidth = Math.max(field.width * scale, 4)
                  const displayHeight = Math.max(field.height * scale, 4)
                  const textBaseline = displayTop + displayHeight * field.baseline

                  return (
                    <div
                      key={key}
                      className="absolute"
                      style={{
                        left: displayLeft,
                        top: displayTop,
                        width: displayWidth,
                        height: displayHeight,
                      }}
                    >
                      <div
                        className={`absolute inset-0 rounded-lg border ${
                          isActive ? 'border-gray-900' : 'border-white/80'
                        } bg-black/10`}
                      />
                      <div
                        className="absolute left-1 right-1"
                        style={{
                          top: textBaseline - field.fontSize * scale,
                        }}
                      >
                        <p
                          className={`text-[${field.fontSize * scale}px] leading-none text-white`}
                          style={{
                            fontSize: `${field.fontSize * scale}px`,
                            textAlign: field.align,
                          }}
                        >
                          {field.sample}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">Campos disponibles</h2>
                <div className="mt-4 space-y-2">
                  {FIELD_DEFINITIONS.map(({ key, label }) => {
                    const field = fields[key]
                    const isActive = key === activeField
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setActiveField(key)
                          setDrawingField(null)
                        }}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          isActive
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="block font-medium">{label}</span>
                        <span className="block text-xs text-gray-500">
                          {field.sample.slice(0, 32)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setDrawingField(activeField)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  <MousePointer2 className="h-4 w-4 text-gray-500" />
                  Dibujar zona para {fields[activeField].sample}
                </button>
              </div>

              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Editar campo</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Ajusta valores numéricos para afinar la posición. Usa baseline si el texto queda
                  demasiado alto o bajo dentro del recuadro.
                </p>
                <div className="mt-4 space-y-3">
                  {([
                    { label: 'Posición X', property: 'x', min: 0, max: imageNaturalWidth ?? 2000 },
                    { label: 'Posición Y', property: 'y', min: 0, max: imageNaturalHeight ?? 2000 },
                    { label: 'Ancho', property: 'width', min: 10, max: imageNaturalWidth ?? 2000 },
                    { label: 'Alto', property: 'height', min: 10, max: imageNaturalHeight ?? 2000 },
                    { label: 'Tamaño fuente', property: 'fontSize', min: 10, max: 160 },
                  ] as const).map(({ label, property, min, max }) => (
                    <label key={property} className="block text-xs font-semibold text-gray-600">
                      {label}
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={Math.round(
                          ((fields[activeField]?.[property] as number | undefined) ?? 0) * 100,
                        ) / 100}
                        onChange={(event) =>
                          handleBoxInputChange(
                            activeField,
                            property,
                            Number.parseFloat(event.target.value) || 0,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </label>
                  ))}

                  <label className="block text-xs font-semibold text-gray-600">
                    Baseline (0 top - 1 bottom)
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={Number(((fields[activeField]?.baseline ?? 0).toFixed(2)))}
                      onChange={(event) =>
                        handleBoxInputChange(
                          activeField,
                          'baseline',
                          Math.min(Math.max(Number.parseFloat(event.target.value) || 0, 0), 1),
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-gray-600">
                    Alineación
                    <select
                      value={fields[activeField]?.align ?? 'left'}
                      onChange={(event) =>
                        handleBoxInputChange(activeField, 'align', event.target.value as AlignMode)
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    >
                      <option value="left">Izquierda</option>
                      <option value="center">Centro</option>
                      <option value="right">Derecha</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-gray-600">
                    Texto de prueba
                    <input
                      type="text"
                      value={fields[activeField]?.sample ?? ''}
                      onChange={(event) =>
                        handleBoxInputChange(activeField, 'sample', event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Layout para pegar</h3>
                  <button
                    type="button"
                    onClick={() => handleCopy(layoutSnippet)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                    disabled={!layoutSnippet}
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                    Copiar
                  </button>
                </div>
                <pre className="mt-3 max-h-48 overflow-auto rounded-2xl bg-[#111] px-4 py-3 text-xs text-[#FAF9F6]">
                  {layoutSnippet || '// Ajusta los campos para generar coordenadas'}
                </pre>
              </section>

              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Raw data</h3>
                  <button
                    type="button"
                    onClick={() => handleCopy(rawDataSnippet)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                    disabled={!rawDataSnippet}
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                    Copiar
                  </button>
                </div>
                <pre className="mt-3 max-h-48 overflow-auto rounded-2xl bg-[#111] px-4 py-3 text-xs text-[#FAF9F6]">
                  {rawDataSnippet}
                </pre>
              </section>
            </aside>
          </section>
        )}
      </div>
    </main>
  )
}
