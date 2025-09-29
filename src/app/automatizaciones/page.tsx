import PanelLayout from '@/components/panel-layout'

type AutomationStatus = 'Activa' | 'En pausa' | 'Pendiente'

interface AutomationItem {
  id: string
  name: string
  description: string
  channel: string
  status: AutomationStatus
  lastRun: string
}

const activeAutomations: AutomationItem[] = [
  {
    id: 'auto-01',
    name: 'Seguimiento automático de envíos',
    description: 'Envía actualizaciones de estado a clientes vía email y WhatsApp.',
    channel: 'Logística · WhatsApp',
    status: 'Activa',
    lastRun: 'Hace 5 minutos',
  },
  {
    id: 'auto-02',
    name: 'Confirmación de citas médicas',
    description: 'Confirma o reprograma citas automáticamente según respuesta del paciente.',
    channel: 'Clínicas · WhatsApp',
    status: 'Activa',
    lastRun: 'Hace 18 minutos',
  },
  {
    id: 'auto-03',
    name: 'Informe diario de inbox',
    description: 'Genera un resumen de correos prioritarios cada mañana a las 8:00.',
    channel: 'Productividad · Gmail',
    status: 'En pausa',
    lastRun: 'Hace 2 días',
  },
]

const suggestions = [
  {
    title: 'Marketplace de automatizaciones',
    description: 'Explora plantillas listas según tu sector y proceso operativo.',
    href: '/dashboard#marketplace',
  },
  {
    title: 'Configurar nueva automatización',
    description: 'Crea tu propio flujo desde cero conectando tus cuentas.',
    href: '/automatizaciones/nueva',
  },
  {
    title: 'Solicitar ajuste de flujo',
    description: 'Nuestro equipo puede personalizar respuestas o integraciones.',
    href: '/contacto',
  },
]

export default function AutomatizacionesPage() {
  const activeCount = activeAutomations.filter((item) => item.status === 'Activa').length
  const pendingCount = activeAutomations.filter((item) => item.status === 'Pendiente').length

  return (
    <PanelLayout>
      <div className="space-y-12 sm:space-y-16">
        <section className="rounded-3xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-4 py-1 text-xs font-semibold uppercase tracking-[0.08em]">
              Automatizaciones
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
              Controla tus flujos activos y crea nuevos en minutos
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Revisa el estado de ejecución, pausa automatizaciones temporalmente o abre el marketplace para activar un nuevo flujo.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
            <p className="text-sm text-gray-600">Automatizaciones activas</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{activeCount}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
              En ejecución ahora mismo
            </p>
          </div>
          <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
            <p className="text-sm text-gray-600">Flujos pausados</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {activeAutomations.length - activeCount - pendingCount}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
              Pendientes de revisar
            </p>
          </div>
          <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
            <p className="text-sm text-gray-600">Pendientes de activación</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{pendingCount}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
              Requieren confirmación final
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">Tus automatizaciones</h2>
              <p className="text-sm text-gray-600">Gestiona el estado, consulta el histórico y modifica la configuración cuando quieras.</p>
            </div>
            <a
              href="/dashboard#marketplace"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
            >
              Activar nueva automatización
            </a>
          </div>

          <div className="space-y-4">
            {activeAutomations.map((automation) => (
              <article
                key={automation.id}
                className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-7 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                  <p className="text-sm text-gray-600">{automation.description}</p>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{automation.channel}</p>
                </div>
                <div className="flex flex-col sm:items-end gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        automation.status === 'Activa'
                          ? 'bg-emerald-100 text-emerald-700'
                          : automation.status === 'En pausa'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {automation.status}
                    </span>
                    <span className="text-xs text-gray-500">Última ejecución: {automation.lastRun}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/automations/${automation.id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
                    >
                      Ver detalles
                    </a>
                    <a
                      href={`/automations/${automation.id}/edit`}
                      className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:opacity-90 transition"
                    >
                      Ajustar flujo
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((item) => (
            <article key={item.title} className="rounded-3xl border border-dashed border-gray-300 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              <a
                href={item.href}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition"
              >
                Ir ahora
              </a>
            </article>
          ))}
        </section>

        <section className="rounded-3xl bg-gray-900 text-white px-8 py-10 sm:px-10 sm:py-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">¿Necesitas ayuda para optimizar tus flujos?</h2>
            <p className="mt-2 text-sm text-white/80 max-w-xl">
              Nuestro equipo puede revisar tus automatizaciones actuales y proponer mejoras o nuevas integraciones para cubrir más procesos.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/contacto"
              className="inline-flex items-center justify-center rounded-xl bg-white text-gray-900 px-4 py-2.5 text-sm font-semibold hover:bg-gray-100 transition"
            >
              Agenda una sesión
            </a>
            <a
              href="mailto:info@saraquintana.es"
              className="inline-flex items-center justify-center rounded-xl border border-white/30 text-white px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition"
            >
              Escribir al soporte
            </a>
          </div>
        </section>
      </div>
    </PanelLayout>
  )
}
