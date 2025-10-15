import PanelLayout from '@/components/panel-layout'

type AutomationFocus = 'Agronomía' | 'Almacén' | 'Logística'

interface AutomationProcess {
  name: string
  description: string
  impact: string
}

interface AutomationCategory {
  id: string
  title: string
  focus: AutomationFocus
  summary: string
  processes: AutomationProcess[]
}

const whatsappBaseUrl = 'https://wa.me/34655689827'

function getWhatsAppLink(processName: string) {
  const message = `Hola, quiero activar la automatización "${processName}" en mi operación.`
  return `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`
}

const automationCategories: AutomationCategory[] = [
  {
    id: 'agronomia',
    title: 'Agronomía en campo',
    focus: 'Agronomía',
    summary:
      'Sincroniza monitoreos, tratamientos y órdenes de trabajo para mantener cada lote con trazabilidad diaria sin hojas de cálculo.',
    processes: [
      {
        name: 'Planificador de riegos inteligente',
        description:
          'Analiza humedad del suelo, pronóstico y turnos disponibles para ordenar riegos prioritarios enviando avisos a encargados vía WhatsApp.',
        impact: 'Evita riegos duplicados y optimiza el uso de agua en jornadas críticas.',
      },
      {
        name: 'Bitácora automática de aplicaciones',
        description:
          'Genera fichas PDF con cada aplicación fitosanitaria, adjunta evidencia fotográfica y sincroniza la información con tu histórico nativo.',
        impact: 'Simplifica auditorías y reduce tiempo en reportes regulatorios.',
      },
    ],
  },
  {
    id: 'almacen',
    title: 'Control de almacén',
    focus: 'Almacén',
    summary:
      'Integra lecturas de etiquetas con stock en tiempo real, alertando de bajas críticas y movimientos pendientes de validar.',
    processes: [
      {
        name: 'Conteo cíclico guiado',
        description:
          'Construye listas de conteo semanales, asigna responsables por zona y captura resultados con etiquetas QR o códigos de barras.',
        impact: 'Mantiene inventario confiable sin detener operaciones diarias.',
      },
      {
        name: 'Recepción con validación automática',
        description:
          'Compara albaranes contra pedidos, destaca incidencias y genera tickets de seguimiento para compras cuando falta stock.',
        impact: 'Reduce discrepancias y acelera la puesta en stock de insumos clave.',
      },
    ],
  },
  {
    id: 'logistica',
    title: 'Logística y expediciones',
    focus: 'Logística',
    summary:
      'Coordina expediciones, rutas y confirmaciones de entrega con alertas proactivas para equipos internos y clientes finales.',
    processes: [
      {
        name: 'Asignador de rutas por demanda',
        description:
          'Ordena pedidos por prioridad, consolida cargas según destino y envía rutas sugeridas con actualizaciones en tiempo real.',
        impact: 'Disminuye tiempos muertos y mejora la puntualidad de entregas.',
      },
      {
        name: 'Confirmación automática de entregas',
        description:
          'Envía recordatorios previos, captura evidencia fotográfica y cierra entregas en tu ERP sin intervención manual.',
        impact: 'Acelera cierres de logística y mejora la satisfacción del cliente.',
      },
    ],
  },
]

export default function AjustesPage() {
  return (
    <PanelLayout>
      <div className="space-y-12 sm:space-y-16">
        <section className="rounded-3xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-4 py-1 text-xs font-semibold uppercase tracking-[0.08em]">
              Procesos recomendados
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
              Activa automatizaciones clave para agronomía, almacén y logística
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Descubre los flujos que recomendamos para empresas agro con operaciones integradas. Cada proceso conecta a tus
              equipos y mantiene los datos listos para auditorías, expediciones y control de stock.
            </p>
          </div>
        </section>

        <section className="space-y-10">
          {automationCategories.map((category) => (
            <article
              key={category.id}
              className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase">
                    {category.focus}
                  </span>
                  <h2 className="text-2xl font-semibold text-gray-900">{category.title}</h2>
                  <p className="text-sm text-gray-600">{category.summary}</p>
                </div>
                <a
                  href={`${whatsappBaseUrl}?text=${encodeURIComponent(
                    `Hola, quiero priorizar un paquete de automatizaciones para ${category.focus.toLowerCase()}.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
                >
                  Coordinar paquete completo
                </a>
              </div>

              <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                {category.processes.map((process) => (
                  <div
                    key={process.name}
                    className="rounded-2xl border border-gray-200 bg-[#FAF9F6] p-5 flex flex-col gap-4"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{process.name}</h3>
                      <p className="mt-2 text-sm text-gray-600">{process.description}</p>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-emerald-700">{process.impact}</p>
                    <a
                      href={getWhatsAppLink(process.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center justify-center rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-semibold hover:bg-emerald-700 transition"
                    >
                      Añadir este proceso
                    </a>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </PanelLayout>
  )
}
