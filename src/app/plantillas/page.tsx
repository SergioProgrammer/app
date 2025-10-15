import PanelLayout from '@/components/panel-layout'
import Image from 'next/image'
import fs from 'fs'
import path from 'path'

interface TemplateItem {
  fileName: string
  displayName: string
  src: string
  updatedAt: string
  size: string
}

function formatBytes(bytes: number | null): string {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) {
    return 'Tamaño no disponible'
  }
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)

  return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)} ${units[exponent]}`
}

function formatDate(date: Date | null): string {
  if (!date) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function loadTemplates(): TemplateItem[] {
  const publicDir = path.join(process.cwd(), 'public')
  const templateFiles = ['Etiqueta.PNG']

  return templateFiles.map((fileName) => {
    const absolutePath = path.join(publicDir, fileName)
    let stats: fs.Stats | null = null

    try {
      stats = fs.statSync(absolutePath)
    } catch {
      stats = null
    }

    return {
      fileName,
      displayName: fileName.replace(/\.[^/.]+$/, ''),
      src: `/${fileName}`,
      updatedAt: formatDate(stats ? stats.mtime : null),
      size: formatBytes(stats ? stats.size : null),
    }
  })
}

export default function PlantillasPage() {
  const templates = loadTemplates()

  return (
    <PanelLayout>
      <div className="space-y-12 sm:space-y-16">
        <section className="rounded-3xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-4 py-1 text-xs font-semibold uppercase tracking-[0.08em]">
              Plantillas de etiquetas
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
              Consulta las plantillas disponibles antes de activar nuevos lotes
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Visualiza las plantillas cargadas, verifica la última actualización y descarga la versión más reciente para tus
              equipos de agronomía, almacén y logística.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          {templates.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
              Aún no hay plantillas disponibles. Sube la primera desde tus integraciones o solicita ayuda al equipo.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {templates.map((template) => (
                <article
                  key={template.fileName}
                  className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm flex flex-col gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      <Image
                        src={template.src}
                        alt={`Plantilla ${template.displayName}`}
                        fill
                        sizes="64px"
                        style={{ objectFit: 'contain' }}
                        priority
                      />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{template.displayName}</h2>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Formato original: {template.fileName}</p>
                    </div>
                  </div>

                  <dl className="grid gap-3 text-xs text-gray-600 sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-gray-900">Última actualización</dt>
                      <dd className="mt-1">{template.updatedAt}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">Tamaño</dt>
                      <dd className="mt-1">{template.size}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex flex-wrap gap-3">
                    <a
                      href={template.src}
                      download={template.fileName}
                      className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
                    >
                      Descargar
                    </a>
                    <a
                      href={template.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
                    >
                      Ver vista previa
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </PanelLayout>
  )
}
