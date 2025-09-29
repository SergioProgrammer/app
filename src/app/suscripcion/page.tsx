import PanelLayout from '@/components/panel-layout'

const availablePlans = [
  {
    name: 'Starter',
    price: '49€',
    description: 'Ideal para equipos pequeños que activan su primera automatización.',
    features: ['1 automatización activa', 'Soporte email en 24h', 'Informes básicos'],
    href: '/dashboard#planes',
  },
  {
    name: 'Growth',
    price: '129€',
    description: 'Incluye onboarding guiado y métricas avanzadas para varias áreas.',
    features: ['Hasta 5 automatizaciones', 'Onboarding acompañado', 'Alertas avanzadas'],
    href: '/dashboard#planes',
    highlight: true,
  },
  {
    name: 'Scale',
    price: '249€',
    description: 'Pensado para operaciones con múltiples equipos y conectores a medida.',
    features: ['Automatizaciones ilimitadas', 'Integraciones personalizadas', 'Soporte 24/7'],
    href: '/dashboard#planes',
  },
]

const billingHistory = [
  { id: 'FAC-2304', period: 'Abr 2024', amount: '129€', status: 'Pagada' },
  { id: 'FAC-2303', period: 'Mar 2024', amount: '129€', status: 'Pagada' },
  { id: 'FAC-2302', period: 'Feb 2024', amount: '129€', status: 'Pagada' },
]

export default function SuscripcionPage() {
  return (
    <PanelLayout>
      <div className="space-y-12 sm:space-y-16">
        <section className="rounded-3xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center rounded-full bg-lime-100 text-lime-700 px-4 py-1 text-xs font-semibold uppercase tracking-[0.08em]">
              Suscripción
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
              Gestiona tu plan y la facturación desde un solo lugar
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Consulta el estado de tu plan actual, revisa próximos cargos y descarga facturas en segundos.
            </p>
          </div>
        </section>

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Plan actual</h2>
              <p className="mt-1 text-sm text-gray-600">Growth — renovará el 12 de mayo de 2024</p>
            </div>
            <span className="rounded-full bg-gray-900 text-white px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Activo
            </span>
          </div>
          <div className="mt-6 space-y-3 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Cuota mensual</span>
              <strong className="text-gray-900">129€</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Automatizaciones activas incluidas</span>
              <span>Hasta 5</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Soporte</span>
              <span>Prioritario (respuesta &lt; 4h)</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/dashboard#marketplace"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
            >
              Añadir automatización
            </a>
            <a
              href="#planes"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
            >
              Cambiar de plan
            </a>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Método de pago</h3>
            <p className="text-sm text-gray-600">Visa terminada en 4242</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-[#FAF9F6] p-4 text-sm text-gray-700 space-y-2">
            <div className="flex items-center justify-between">
              <span>Titular</span>
              <span>Sara Quintana</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Expira</span>
              <span>08/26</span>
            </div>
          </div>
          <a
            href="#"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
          >
            Actualizar método de pago
          </a>
        </div>
      </section>

      <section id="planes" className="space-y-6">
        <div className="max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">Planes disponibles</h2>
          <p className="mt-2 text-sm text-gray-600">
            Cambia de plan cuando quieras; mantenemos tus automatizaciones sin interrupciones.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {availablePlans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-3xl border ${
                plan.highlight ? 'border-gray-900 bg-gray-900 text-white shadow-lg shadow-gray-900/10' : 'border-gray-200 bg-white'
              } p-6 flex flex-col`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.highlight && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Recomendado
                  </span>
                )}
              </div>
              <p className={`mt-2 text-sm ${plan.highlight ? 'text-gray-100' : 'text-gray-600'}`}>{plan.description}</p>
              <p className="mt-5 text-3xl font-semibold">
                {plan.price}
                <span className="ml-1 text-sm font-medium opacity-70">/mes</span>
              </p>
              <ul className={`mt-5 space-y-3 text-sm ${plan.highlight ? 'text-gray-100' : 'text-gray-700'}`}>
                {plan.features.map((feature) => (
                  <li key={`${plan.name}-${feature}`} className="flex items-start gap-2">
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full ${plan.highlight ? 'bg-white' : 'bg-gray-900'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                className={`mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  plan.highlight ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:opacity-90'
                }`}
              >
                Elegir plan
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Historial de facturación</h2>
            <p className="text-sm text-gray-600">Descarga tus facturas o consulta el estado de los últimos cobros.</p>
          </div>
          <a
            href="#"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
          >
            Ver todo el historial
          </a>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-[#FAF9F6] text-gray-600 uppercase tracking-wide text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Factura</th>
                <th className="px-4 py-3 text-left">Periodo</th>
                <th className="px-4 py-3 text-left">Importe</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {billingHistory.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-[#FAF9F6] transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{invoice.id}</td>
                  <td className="px-4 py-3">{invoice.period}</td>
                  <td className="px-4 py-3">{invoice.amount}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-semibold">
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href="#" className="text-sm font-medium text-gray-900 hover:underline">
                      Descargar PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

        <section className="rounded-3xl border border-dashed border-gray-300 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">¿Necesitas ayuda con tu plan?</h2>
          <p className="mt-2 text-sm text-gray-600">
            Escríbenos para ajustar tu facturación, añadir usuarios adicionales o solicitar un plan anual personalizado.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="mailto:info@saraquintana.es"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
            >
              Contactar soporte
            </a>
            <a
              href="/contacto"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
            >
              Agendar llamada
            </a>
          </div>
        </section>
      </div>
    </PanelLayout>
  )
}
