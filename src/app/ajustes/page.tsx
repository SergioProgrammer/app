import PanelLayout from '@/components/panel-layout'

const notificationPreferences = [
  {
    id: 'email-updates',
    label: 'Resúmenes por email',
    description: 'Recibe un informe semanal con métricas clave de tus automatizaciones.',
    defaultChecked: true,
  },
  {
    id: 'whatsapp-alerts',
    label: 'Alertas por WhatsApp',
    description: 'Te avisamos si un flujo se pausa o requiere tu intervención.',
    defaultChecked: true,
  },
  {
    id: 'product-updates',
    label: 'Novedades del producto',
    description: 'Actualizaciones ocasionales sobre nuevas plantillas e integraciones.',
    defaultChecked: false,
  },
]

export default function AjustesPage() {
  return (
    <PanelLayout>
      <div className="space-y-12 sm:space-y-16">
        <section className="rounded-3xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-4 py-1 text-xs font-semibold uppercase tracking-[0.08em]">
              Ajustes
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
              Configura tu cuenta y preferencias en pocos pasos
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Actualiza tu información, habilita verificaciones adicionales y decide cómo quieres recibir alertas importantes.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <article className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Perfil</h2>
                  <p className="text-sm text-gray-600">Gestiona los datos principales de tu cuenta.</p>
                </div>
                <a
                  href="#"
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
                >
                  Editar perfil
                </a>
              </div>

              <dl className="mt-6 space-y-4 text-sm text-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <dt className="font-medium text-gray-900">Nombre completo</dt>
                  <dd>Sara Quintana</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <dt className="font-medium text-gray-900">Correo</dt>
                  <dd>info@saraquintana.es</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <dt className="font-medium text-gray-900">Empresa</dt>
                  <dd>Procesia</dd>
                </div>
              </dl>
            </article>

            <article className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-7 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Seguridad</h2>
              <p className="mt-2 text-sm text-gray-600">Refuerza el acceso y protege los datos de tus automatizaciones.</p>

              <div className="mt-6 space-y-5">
                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-[#FAF9F6] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Doble factor de autenticación</p>
                      <p className="text-xs text-gray-600">Protege tu cuenta solicitando un código adicional en cada acceso.</p>
                    </div>
                    <a
                      href="#"
                      className="inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold hover:opacity-90 transition"
                    >
                      Activar
                    </a>
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-[#FAF9F6] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Enlaces conectados</p>
                      <p className="text-xs text-gray-600">Revisa y revoca el acceso a Gmail, WhatsApp o CRMs conectados.</p>
                    </div>
                    <a
                      href="/ajustes/integraciones"
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-100 transition"
                    >
                      Ver integraciones
                    </a>
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-[#FAF9F6] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Actividad reciente</p>
                      <p className="text-xs text-gray-600">Consulta los últimos accesos y cambios realizados en tu cuenta.</p>
                    </div>
                    <a
                      href="/ajustes/actividad"
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-100 transition"
                    >
                      Revisar
                    </a>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <aside className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-7 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Preferencias</h2>
              <p className="mt-2 text-sm text-gray-600">Personaliza cómo quieres recibir avisos y novedades.</p>
            </div>
            <form className="space-y-4">
              {notificationPreferences.map((preference) => (
                <label
                  key={preference.id}
                  htmlFor={preference.id}
                  className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-[#FAF9F6] p-4 cursor-pointer"
                >
                  <input
                    id={preference.id}
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    defaultChecked={preference.defaultChecked}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{preference.label}</span>
                    <span className="block text-xs text-gray-600 mt-1">{preference.description}</span>
                  </span>
                </label>
              ))}
            </form>

            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
              ¿No ves la preferencia que buscas? Escríbenos y la añadimos.
            </div>
            <a
              href="mailto:info@saraquintana.es"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
            >
              Contactar soporte
            </a>
          </aside>
        </section>

        <section className="rounded-3xl bg-gray-900 text-white px-8 py-10 sm:px-10 sm:py-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Administra accesos de equipo</h2>
            <p className="mt-2 text-sm text-white/80 max-w-xl">
              Añade nuevos miembros, asigna roles y controla qué automatizaciones puede ver cada uno para mantener tus operaciones seguras.
            </p>
          </div>
          <a
            href="/ajustes/equipo"
            className="inline-flex items-center justify-center rounded-xl bg-white text-gray-900 px-4 py-2.5 text-sm font-semibold hover:bg-gray-100 transition"
          >
            Gestionar equipo
          </a>
        </section>
      </div>
    </PanelLayout>
  )
}
