'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { BarChart, CreditCard, Search, Settings, Sprout, Workflow } from 'lucide-react'
import {
  getPanelConfig,
  getPanelSlugForUser,
  type AutomationDetail,
  type AutomationTemplate,
  type PanelPlanDatasetConfig,
  type PanelPlanOrderConfig,
  type PanelPlanResource,
} from '@/lib/panel-config'

interface PlanRecord {
  id: string
  title: string
  status?: string
  updatedAt?: string
  description?: string
}

interface ActivePlan {
  id: string
  name: string
  summary?: string
  resources?: PanelPlanResource[]
  records?: PlanRecord[]
  dataset?: PanelPlanDatasetConfig
}

interface TurnoRecord {
  id: string
  worker: string
  date?: string
  entryTime?: string
  status?: string
  fichado?: boolean
  createdAt?: string
  raw?: Record<string, unknown>
}

interface TurnosChartPoint {
  hour: string
  count: number
}

type TurnosDownloadRange = 'day' | 'week' | 'month' | 'year'

const TURNOS_RECENT_LIMIT = 8
const TURNOS_FETCH_LIMIT = 32

export default function PanelPage() {
  const params = useParams<{ slug: string }>()
  const rawSlug =
    typeof params?.slug === 'string'
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : 'general'
  const slug = rawSlug?.toLowerCase() ?? 'general'

  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [turnosData, setTurnosData] = useState<TurnoRecord[]>([])
  const [turnosLoading, setTurnosLoading] = useState(false)
  const [turnosError, setTurnosError] = useState<string | null>(null)
  const [turnosDownloadRange, setTurnosDownloadRange] = useState<TurnosDownloadRange>('day')
  const [turnosDownloadLoading, setTurnosDownloadLoading] = useState(false)
  const [turnosActiveTable, setTurnosActiveTable] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      setUser(session.user)
    }

    loadUser()
  }, [router, supabase])

  useEffect(() => {
    if (!user) return

    const allowedSlug = getPanelSlugForUser(user)
    if (allowedSlug !== slug) {
      router.replace(`/panel/${allowedSlug}`)
    }
  }, [router, slug, user])

  const panelConfig = useMemo(() => getPanelConfig(slug), [slug])
  const detail: AutomationDetail = panelConfig.detail
  const templatesFromConfig: AutomationTemplate[] = panelConfig.templates

  const registerUrl = detail.cta?.primaryHref ?? 'https://app-procesia.vercel.app/registro'
  const contactUrl = detail.cta?.secondaryHref ?? '/contacto'
  const sections = detail.sections ?? []

  const activePlans: ActivePlan[] = useMemo(() => {
    const configPlans = panelConfig.plans ?? []
    const stored = (user?.user_metadata?.activePlans ?? []) as Partial<ActivePlan>[]

    if (Array.isArray(stored) && stored.length > 0) {
      return stored.map((plan, index) => {
        const configMatch = configPlans.find((cfg) => cfg.id === plan.id)
        return {
          id: plan.id ?? configMatch?.id ?? `plan-${index}`,
          name: plan.name ?? configMatch?.name ?? 'Plan sin nombre',
          summary: plan.summary ?? configMatch?.summary,
          resources: plan.resources ?? configMatch?.resources ?? [],
          dataset: configMatch?.dataset,
          records: plan.records ?? [],
        }
      })
    }

    return configPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      summary: plan.summary,
      resources: plan.resources ?? [],
      dataset: plan.dataset,
    }))
  }, [panelConfig, user?.user_metadata])

  const turnosPlan = useMemo(
    () => activePlans.find((plan) => plan.dataset?.type === 'turnos'),
    [activePlans],
  )

  useEffect(() => {
    const dataset = turnosPlan?.dataset
    if (!dataset) {
      setTurnosActiveTable(null)
      return
    }

    setTurnosActiveTable((current) => current ?? dataset.table)
  }, [turnosPlan])

  const loadTurnos = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!turnosPlan?.dataset || !user) return

      const silent = options?.silent ?? false

      if (!silent) {
        setTurnosLoading(true)
      }

      const dataset = turnosPlan.dataset
      const email = user.email ?? null

      const baseTable = dataset.table
      const fallbacks = dataset.fallbackTables ?? []
      const candidateTables = [baseTable, turnosActiveTable, ...fallbacks]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
      const tablesToTry = Array.from(new Set(candidateTables))
      const orderPreferences = buildOrderPreferences(dataset.orderBy)

      let success = false
      let encounteredEmpty = false
      let lastErrorMessage: string | null = null
      let missingTableMessage: string | null = null

      try {
        tableLoop: for (const tableName of tablesToTry) {
          const orderSets = orderPreferences.length > 0 ? orderPreferences : [[]]

          for (const orders of orderSets) {
            let queryBuilder = supabase.from(tableName).select('*')

            if (dataset.emailColumn && email) {
              queryBuilder = queryBuilder.eq(dataset.emailColumn, email)
            }

            for (const order of orders) {
              queryBuilder = queryBuilder.order(order.column, {
                ascending: order.ascending ?? false,
                nullsFirst: order.nullsFirst,
              })
            }

            const { data, error } = await queryBuilder.limit(TURNOS_FETCH_LIMIT)

            if (error) {
              lastErrorMessage = error.message

              if (isMissingTableError(error.message)) {
                missingTableMessage = error.message
                continue tableLoop
              }

              if (isMissingColumnError(error.message)) {
                continue
              }

              continue tableLoop
            }

            const mapped = (data ?? []).map(mapRowToTurnoRecord)
            const sorted = sortTurnoRecords(mapped)
            const truncated = sorted.slice(0, TURNOS_RECENT_LIMIT)

            setTurnosActiveTable(tableName)

            if (truncated.length === 0) {
              encounteredEmpty = true
              setTurnosError(null)
              setTurnosData([])
              continue tableLoop
            }

            setTurnosError(null)
            setTurnosData(truncated)
            success = true
            break tableLoop
          }
        }

        if (!success) {
          if (encounteredEmpty) {
            setTurnosError(null)
            setTurnosData([])
            return
          }
          const message =
            lastErrorMessage ??
            missingTableMessage ??
            'No se pudieron cargar los turnos. Intenta de nuevo en unos segundos.'
          setTurnosError(message)
          setTurnosData([])
        }
      } finally {
        if (!silent) {
          setTurnosLoading(false)
        }
      }
    },
    [supabase, turnosActiveTable, turnosPlan, user],
  )

  useEffect(() => {
    if (!turnosPlan || !user) return

    let cancelled = false

    const load = async () => {
      if (cancelled) return
      await loadTurnos()
    }

    load()
    const interval = setInterval(() => {
      if (cancelled || document.hidden) return
      loadTurnos({ silent: true })
    }, 15_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [loadTurnos, turnosPlan, user])

  useEffect(() => {
    if (!turnosPlan?.dataset || !user || !turnosActiveTable) return

    const emailFilter =
      turnosPlan.dataset.emailColumn && user.email
        ? `${turnosPlan.dataset.emailColumn}=eq.${user.email}`
        : undefined

    const channel = supabase
      .channel(`turnos-${turnosActiveTable}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: turnosActiveTable,
          ...(emailFilter ? { filter: emailFilter } : {}),
        },
        () => {
          loadTurnos({ silent: true })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTurnos, supabase, turnosActiveTable, turnosPlan?.dataset, user])

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templatesFromConfig
    return templatesFromConfig.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    )
  }, [query, templatesFromConfig])

  const turnosStats = useMemo(() => {
    const total = turnosData.length
    const fichados = turnosData.filter((record) => isRecordFichado(record)).length
    const workers = new Set(turnosData.map((record) => record.worker).filter(Boolean)).size
    const pendientes = Math.max(total - fichados, 0)
    return { total, fichados, pendientes, workers }
  }, [turnosData])

  const turnosByDate = useMemo(() => {
    const map = new Map<string, { total: number; fichados: number }>()
    turnosData.forEach((record) => {
      const date = record.date ?? 'Sin fecha'
      const existing = map.get(date) ?? { total: 0, fichados: 0 }
      existing.total += 1
      if (isRecordFichado(record)) {
        existing.fichados += 1
      }
      map.set(date, existing)
    })
    return Array.from(map.entries())
      .map(([date, info]) => ({ date, ...info }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [turnosData])

  const turnosChartData = useMemo(() => {
    const buckets = new Map<string, number>()
    turnosData.forEach((record) => {
      const hour = extractHour(record.entryTime)
      buckets.set(hour, (buckets.get(hour) ?? 0) + 1)
    })
    return Array.from(buckets.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
  }, [turnosData])

  const handleDownloadTurnos = useCallback(
    async (range: TurnosDownloadRange) => {
      if (!turnosPlan?.dataset || !user) {
        window.alert('No encontramos un plan configurado para descargar turnos.');
        return
      }

      setTurnosDownloadLoading(true)

      const dataset = turnosPlan.dataset
      const now = new Date()
      const fromDate = new Date(now)

      if (range === 'day') {
        fromDate.setHours(0, 0, 0, 0)
      } else if (range === 'week') {
        fromDate.setDate(fromDate.getDate() - 7)
        fromDate.setHours(0, 0, 0, 0)
      } else if (range === 'month') {
        fromDate.setMonth(fromDate.getMonth() - 1)
        fromDate.setHours(0, 0, 0, 0)
      } else if (range === 'year') {
        fromDate.setFullYear(fromDate.getFullYear() - 1)
        fromDate.setHours(0, 0, 0, 0)
      }

      const toDate = new Date(now)
      toDate.setHours(23, 59, 59, 999)

      try {
        const fallbacks = dataset.fallbackTables ?? []
        const primaryTable = turnosActiveTable ?? dataset.table
        const candidateTables = [dataset.table, primaryTable, ...fallbacks]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
        const tablesToTry = Array.from(new Set(candidateTables))
        const orderPreferences = buildOrderPreferences(dataset.orderBy)
        const rangeColumns = buildRangeColumns(dataset.orderBy)

        let success = false
        let lastErrorMessage: string | null = null
        let rows: string[][] = []

        tableLoop: for (const tableName of tablesToTry) {
          const orderSets = orderPreferences.length > 0 ? orderPreferences : [[]]

          for (const orders of orderSets) {
            const rangeOptions = rangeColumns.length > 0 ? rangeColumns : [null]

            for (const rangeColumn of rangeOptions) {
              let queryBuilder = supabase.from(tableName).select('*')

              const email = user.email ?? null
              if (dataset.emailColumn && email) {
                queryBuilder = queryBuilder.eq(dataset.emailColumn, email)
              }

              const applyServerRange = rangeColumn && rangeColumn !== 'fecha'
              if (applyServerRange) {
                queryBuilder = queryBuilder
                  .gte(rangeColumn, fromDate.toISOString())
                  .lte(rangeColumn, toDate.toISOString())
              }

              for (const order of orders) {
                queryBuilder = queryBuilder.order(order.column, {
                  ascending: order.ascending ?? false,
                  nullsFirst: order.nullsFirst,
                })
              }

              const { data, error } = await queryBuilder

              if (error) {
                lastErrorMessage = error.message

                if (isMissingTableError(error.message)) {
                  continue tableLoop
                }

                if (isMissingColumnError(error.message)) {
                  continue
                }

                continue tableLoop
              }

              const mapped = (data ?? []).map(mapRowToTurnoRecord)
              const sorted = sortTurnoRecords(mapped)
              const filtered = filterRecordsByRange(sorted, fromDate, toDate)

              rows = filtered.map((record) => [
                record.worker ?? '',
                record.date ?? '',
                record.entryTime ?? '',
                record.status ?? '',
              ])

              setTurnosActiveTable(tableName)
              success = true
              break tableLoop
            }
          }
        }

        if (!success) {
          throw new Error(
            lastErrorMessage ?? 'No se pudo descargar el reporte para el periodo seleccionado.',
          )
        }

        const header = ['Nombre', 'Fecha', 'Hora de entrada', 'Estado']
        const csv = [
          header.join(','),
          ...rows.map((row) =>
            row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','),
          ),
        ].join('\n')

        const fileSuffix: Record<TurnosDownloadRange, string> = {
          day: 'dia',
          week: 'semana',
          month: 'mes',
          year: 'anio',
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `turnos-${fileSuffix[range]}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)

        if (rows.length === 0) {
          console.info('No hay registros en el periodo seleccionado. Se generó un archivo vacío.')
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'No se pudo descargar el reporte.'
        console.error('Error al descargar turnos:', error)
        window.alert(`No se pudo descargar el reporte: ${message}`)
      } finally {
        setTurnosDownloadLoading(false)
      }
    },
    [supabase, turnosActiveTable, turnosPlan, user],
  )

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Topbar */}
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/50 bg-white/70 border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-black flex items-center justify-center text-[#FAF9F6]">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 leading-none">Panel agro en vivo</p>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 leading-tight">
                {user.email}
              </h1>
            </div>
          </div>

          <a
            href="/ajustes"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-black text-[#FAF9F6] px-3 sm:px-4 py-2 text-sm font-medium shadow hover:opacity-90 transition"
          >
            <Settings className="h-4 w-4" />
            Configurar finca
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-12 sm:space-y-16">
          <section className="relative py-10 sm:py-14">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] items-center">
              <div>
                {detail.hero.badge && (
                  <span className="inline-flex items-center rounded-full bg-lime-100 text-lime-700 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]">
                    {detail.hero.badge}
                  </span>
                )}
                <h1 className="mt-4 text-3xl sm:text-4xl lg:text-[2.9rem] leading-tight font-semibold text-gray-900">
                  {detail.hero.title}
                </h1>
                <p className="mt-4 text-lg text-gray-600">{detail.hero.description}</p>
                {detail.hero.highlights && (
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {detail.hero.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-center gap-3">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-lime-400" />
                        <span className="text-sm sm:text-base text-gray-700">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <a
                    href={registerUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white px-5 py-3 text-sm font-medium shadow-lg shadow-gray-900/10 hover:opacity-90 transition"
                  >
                    {detail.cta?.primaryLabel ?? 'Probar en dashboard'}
                  </a>
                  <a
                    href={contactUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white text-gray-900 px-5 py-3 text-sm font-medium hover:bg-gray-100 transition"
                  >
                    {detail.cta?.secondaryLabel ?? 'Hablar con nosotros'}
                  </a>
                </div>
              </div>
              <div className="relative">
                <div className="rounded-3xl border border-lime-200 bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-semibold tracking-wide text-lime-700 uppercase">
                    Cómo se ve en tu panel
                  </h2>
                  <p className="mt-3 text-sm text-gray-600">
                    {detail.hero.panelCopy ??
                      'Sigue la actividad de tu explotación en el dashboard, con indicadores actualizados y alertas en tiempo real.'}
                  </p>
                  {detail.hero.metrics && (
                    <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                      {detail.hero.metrics.map((metric) => (
                        <div key={metric.label} className="rounded-2xl bg-[#FAF9F6] p-4">
                          <dt className="text-xs uppercase tracking-wide text-gray-500">{metric.label}</dt>
                          <dd className="mt-2 text-2xl font-semibold text-gray-900">{metric.value}</dd>
                          {metric.caption && (
                            <p className="mt-1 text-xs text-gray-500">{metric.caption}</p>
                          )}
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base sm:text-lg">Programa agro</h2>
                <CreditCard className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-gray-600 mt-2">Parcela · modo demo</p>
              <a
                href="/suscripcion"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-black text-[#FAF9F6] px-3 py-2 text-sm hover:opacity-90"
              >
                Gestionar plan
              </a>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base sm:text-lg">Agentes de campo activos</h2>
                <Workflow className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-gray-600 mt-2">0</p>
              <a
                href="/automatizaciones"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-black text-[#FAF9F6] px-3 py-2 text-sm hover:opacity-90"
              >
                Desplegar agente
              </a>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base sm:text-lg">Última sincronización</h2>
                <BarChart className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-gray-600 mt-2">
                {new Date().toLocaleString('es-ES', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base sm:text-lg">Tokens de voz</h2>
                <CreditCard className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-gray-600 mt-2">100</p>
              <a
                href="/suscripcion"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-black text-[#FAF9F6] px-3 py-2 text-sm hover:opacity-90"
              >
                Recargar
              </a>
            </div>
          </section>

          <section className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">Mi panel</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Visualiza las automatizaciones activas y descarga reportes de turnos, inventario o tratamientos al instante.
                </p>
              </div>
            </div>

            {activePlans.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-[#FAF9F6] p-6 text-center text-sm text-gray-600">
                Selecciona algún plan para ver resultados aquí. Cuando activemos tus automatizaciones, verás turnos, inventarios y campañas listos para revisar o descargar.
              </div>
            ) : (
              <div className="mt-8 space-y-6">
                {activePlans.map((plan) => (
                  <article
                    key={plan.id}
                    className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm flex flex-col gap-6"
                  >
                    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                        {plan.summary && <p className="text-sm text-gray-600">{plan.summary}</p>}
                      </div>
                      {plan.resources && plan.resources.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                          {plan.resources.map((resource) => {
                            if (resource.variant === 'download' && plan.dataset?.type === 'turnos') {
                              return (
                                <div
                                  key={`${plan.id}-${resource.label}`}
                                  className="flex items-center gap-2"
                                >
                                  <select
                                    value={turnosDownloadRange}
                                    onChange={(event) =>
                                      setTurnosDownloadRange(
                                        event.target.value as TurnosDownloadRange,
                                      )
                                    }
                                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                  >
                                    <option value="day">Hoy</option>
                                    <option value="week">Última semana</option>
                                    <option value="month">Último mes</option>
                                    <option value="year">Último año</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadTurnos(turnosDownloadRange)}
                                    disabled={turnosDownloadLoading}
                                    className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                                      turnosDownloadLoading
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-gray-900 text-white hover:opacity-90'
                                    }`}
                                  >
                                    {turnosDownloadLoading
                                      ? 'Generando…'
                                      : `Descargar ${resource.label}`}
                                  </button>
                                </div>
                              )
                            }

                            if (resource.href) {
                              return (
                                <a
                                  key={`${plan.id}-${resource.label}`}
                                  href={resource.href}
                                  className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                                    resource.variant === 'download'
                                      ? 'bg-gray-900 text-white hover:opacity-90'
                                      : 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-100'
                                  }`}
                                >
                                  {resource.variant === 'download' ? 'Descargar' : 'Ver'} {resource.label}
                                </a>
                              )
                            }

                            return null
                          })}
                        </div>
                      )}
                    </header>

                    {plan.dataset?.type === 'turnos' ? (
                      <TurnosDashboard
                        loading={turnosLoading}
                        error={turnosError}
                        data={turnosData}
                        stats={turnosStats}
                        chartData={turnosChartData}
                        summaryByDate={turnosByDate}
                      />
                    ) : plan.records && plan.records.length > 0 ? (
                      <RecordsTable plan={plan} />
                    ) : (
                      <p className="text-sm text-gray-600">
                        Aún no se registran datos para este plan. En cuanto lleguen registros, aparecerán aquí listos para revisar o descargar.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {sections.map((section) => (
            <section key={section.title} className="py-4 sm:py-6">
              <div className="max-w-3xl">
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">{section.title}</h2>
                {section.subtitle && <p className="mt-3 text-gray-600">{section.subtitle}</p>}
              </div>
              {section.items && (
                <div
                  className={`mt-8 ${
                    section.layout === 'timeline'
                      ? 'space-y-6'
                      : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {section.items.map((item) => (
                    <div
                      key={`${section.title}-${item.title}`}
                      className={`rounded-3xl border border-gray-200 bg-white p-6 shadow-sm ${
                        section.layout === 'timeline' ? 'sm:flex sm:items-start sm:gap-5' : ''
                      }`}
                    >
                      {section.layout === 'timeline' && (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                          {item.step ?? '•'}
                        </div>
                      )}
                      <div className={section.layout === 'timeline' ? 'mt-4 sm:mt-0' : ''}>
                        <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                        <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                        {item.tags && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                              <span
                                key={`${item.title}-${tag}`}
                                className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {section.callout && (
                <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-5 text-sm text-gray-600">
                  {section.callout}
                </div>
              )}
            </section>
          ))}

          <MarketplaceSection
            templates={filteredTemplates}
            query={query}
            onQueryChange={setQuery}
          />

          <CTASection detail={detail} />
        </div>
      </main>
    </div>
  )
}

function TurnosDashboard({
  loading,
  error,
  data,
  stats,
  chartData,
  summaryByDate,
}: {
  loading: boolean
  error: string | null
  data: TurnoRecord[]
  stats: { total: number; fichados: number; pendientes: number; workers: number }
  chartData: TurnosChartPoint[]
  summaryByDate: Array<{ date: string; total: number; fichados: number }>
}) {
  if (error) {
    return (
      <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
        {error}
      </p>
    )
  }

  if (loading && data.length === 0) {
    return <p className="text-sm text-gray-600">Cargando turnos desde Supabase…</p>
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Aún no se han recibido fichajes. En cuanto los capataces envíen audios por WhatsApp, verás aquí los turnos estructurados y listos para descargar.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registros recientes" value={stats.total.toString()} />
        <StatCard label="Fichados" value={stats.fichados.toString()} tone="success" />
        <StatCard label="Pendientes" value={stats.pendientes.toString()} tone="warning" />
        <StatCard label="Cuadrillas registradas" value={stats.workers.toString()} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 bg-[#FAF9F6] px-4 py-3">
            <h4 className="text-sm font-semibold text-gray-700">Últimos turnos registrados</h4>
            <p className="mt-1 text-xs text-gray-500">
              Mostramos los últimos {TURNOS_RECENT_LIMIT} fichajes sincronizados en tiempo real.
            </p>
          </div>
          <div className="max-h-[320px] overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-white text-gray-500 uppercase tracking-wide text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Hora de entrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {data.slice(0, TURNOS_RECENT_LIMIT).map((record) => (
                  <tr key={record.id} className="hover:bg-[#FAF9F6] transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{record.worker}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(record.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatTime(record.entryTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700">Distribución por hora de entrada</h4>
            {chartData.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">Aún no hay horas registradas.</p>
            ) : (
              <div className="mt-5 h-48 flex items-end gap-3">{renderTurnosChart(chartData)}</div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700">Resumen por jornada</h4>
            {summaryByDate.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">Sin jornadas registradas aún.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                {summaryByDate.slice(0, 5).map((item) => (
                  <li
                    key={item.date}
                    className="flex items-center justify-between rounded-xl bg-[#FAF9F6] px-3 py-2"
                  >
                    <span className="font-medium text-gray-900">{formatDate(item.date)}</span>
                    <span>
                      {item.fichados}/{item.total} fichados
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecordsTable({ plan }: { plan: ActivePlan }) {
  if (!plan.records || plan.records.length === 0) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-[#FAF9F6] text-gray-600 uppercase tracking-wide text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Registro</th>
            <th className="px-4 py-3 text-left">Estado</th>
            <th className="px-4 py-3 text-left">Actualizado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-700">
          {plan.records.map((record) => (
            <tr key={`${plan.id}-${record.id}`} className="hover:bg-[#FAF9F6] transition">
              <td className="px-4 py-3 font-medium text-gray-900">
                <div>
                  <span>{record.title}</span>
                  {record.description && (
                    <p className="text-xs text-gray-500 mt-1">{record.description}</p>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{record.status ?? 'En curso'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{record.updatedAt ?? 'Pendiente de sincronización'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarketplaceSection({
  templates,
  query,
  onQueryChange,
}: {
  templates: AutomationTemplate[]
  query: string
  onQueryChange: (value: string) => void
}) {
  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Marketplace de Automatizaciones</h2>
          <p className="text-gray-600 mt-1">
            Solicita una de nuestras plantillas y te la configuramos para que no te preocupes de nada.
          </p>
        </div>

        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar plantillas..."
            className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-0 focus:border-gray-300 focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {templates.map((t) => (
          <article
            key={t.id}
            className="group bg-white rounded-2xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition flex flex-col"
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 w-11 h-11 rounded-xl ${t.accentBg} flex items-center justify-center`}>
                <t.icon className={`h-5 w-5 ${t.accentIcon}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-base sm:text-lg">{t.name}</h3>
                <p className="text-gray-600 text-sm mt-1">{t.description}</p>
              </div>
            </div>

            {t.badges && (
              <div className="mt-4 flex flex-wrap gap-2">
                {t.badges.map((b) => (
                  <span
                    key={`${t.id}-${b}`}
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs text-gray-700"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <a
                href={t.href}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-black text-[#FAF9F6] px-4 py-2.5 text-sm font-medium shadow hover:opacity-90 transition"
              >
                Solicitar
              </a>
              <a
                href={t.href}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
              >
                Ver detalles
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function CTASection({ detail }: { detail: AutomationDetail }) {
  return (
    <section className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            {detail.cta?.finalTitle ?? '¿Listo para desplegar tus automatizaciones clave?'}
          </h2>
          <p className="text-sm text-gray-600">
            {detail.cta?.finalSubtitle ??
              'Activa módulos directamente desde el panel o agenda una sesión con nuestros especialistas para adaptar los flujos a tu operación.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={detail.cta?.primaryHref ?? '/automatizaciones'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black text-[#FAF9F6] px-4 py-2.5 text-sm font-medium shadow hover:opacity-90 transition"
            >
              {detail.cta?.primaryLabel ?? 'Desplegar agente'}
            </a>
            <a
              href={detail.cta?.secondaryHref ?? '/contacto'}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
            >
              {detail.cta?.secondaryLabel ?? 'Hablar con un agrónomo'}
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-gray-300 bg-[#FAF9F6] p-5 text-sm text-gray-600">
          <p>
            Personalizamos cada despliegue según tu explotación, número de usuarios y conectores existentes. Comparte tu calendario agrícola y configuramos un plan de onboarding por parcelas.
          </p>
        </div>
      </div>
    </section>
  )
}

const ORDER_FALLBACK_COLUMNS = [
  'insertado_en',
  'created_at',
  'inserted_at',
  'createdAt',
  'insertedAt',
  'timestamp',
  'fecha_creacion',
  'fecha_creado',
  'created',
]

const RANGE_FALLBACK_COLUMNS = ORDER_FALLBACK_COLUMNS.filter((column) => column !== 'fecha')

function buildOrderPreferences(
  orderBy?: PanelPlanOrderConfig | PanelPlanOrderConfig[],
): PanelPlanOrderConfig[][] {
  const normalized: PanelPlanOrderConfig[] = []
  if (Array.isArray(orderBy)) {
    normalized.push(...orderBy.filter(Boolean))
  } else if (orderBy) {
    normalized.push(orderBy)
  }

  const preferences: PanelPlanOrderConfig[][] = []

  if (normalized.length > 0) {
    preferences.push(normalized)
  }

  const fallbackPreferences = ORDER_FALLBACK_COLUMNS.filter(
    (column) => !normalized.some((order) => order.column === column),
  ).map((column) => [{ column, ascending: false, nullsFirst: false }])

  preferences.push(...fallbackPreferences)

  const hasFechaOnly = preferences.some(
    (set) => set.length === 1 && set[0]?.column === 'fecha',
  )

  if (!hasFechaOnly) {
    preferences.push([{ column: 'fecha', ascending: false, nullsFirst: false }])
  }

  if (preferences.length === 0) {
    return [[{ column: 'fecha', ascending: false, nullsFirst: false }]]
  }

  return preferences
}

function buildRangeColumns(orderBy?: PanelPlanOrderConfig | PanelPlanOrderConfig[]): Array<string | null> {
  const normalized: PanelPlanOrderConfig[] = []
  if (Array.isArray(orderBy)) {
    normalized.push(...orderBy.filter(Boolean))
  } else if (orderBy) {
    normalized.push(orderBy)
  }

  const preferred = normalized.map((order) => order.column)
  const candidates = [...preferred, ...RANGE_FALLBACK_COLUMNS, 'fecha']
  const unique = Array.from(new Set(candidates))
  return unique.length > 0 ? unique : [null]
}

function isMissingColumnError(message?: string | null): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes('column') && normalized.includes('does not exist')
}

function isMissingTableError(message?: string | null): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes('schema cache') ||
    ((normalized.includes('table') || normalized.includes('relation')) &&
      normalized.includes('does not exist'))
  )
}

function sortTurnoRecords(records: TurnoRecord[]): TurnoRecord[] {
  return [...records].sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a))
}

function filterRecordsByRange(
  records: TurnoRecord[],
  fromDate: Date,
  toDate: Date,
): TurnoRecord[] {
  const from = fromDate.getTime()
  const to = toDate.getTime()
  return records.filter((record) => {
    const timestamp = getRecordTimestamp(record)
    if (timestamp === 0) {
      return true
    }
    return timestamp >= from && timestamp <= to
  })
}

function getRecordTimestamp(record: TurnoRecord): number {
  const createdCandidates: Array<unknown> = []
  if (record.createdAt) {
    createdCandidates.push(record.createdAt)
  }

  if (record.raw) {
    for (const key of ORDER_FALLBACK_COLUMNS) {
      if (key in record.raw) {
        createdCandidates.push(record.raw[key])
      }
    }
  }

  for (const candidate of createdCandidates) {
    if (candidate instanceof Date) {
      const value = candidate.getTime()
      if (!Number.isNaN(value)) return value
      continue
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }

    if (typeof candidate === 'string') {
      const parsed = parseDateValue(candidate)
      if (parsed !== null) {
        return parsed
      }
    }
  }

  const dateValue = parseDateValue(record.date)
  if (dateValue !== null) {
    const timeValue = parseTimeValue(record.entryTime)
    if (timeValue) {
      const date = new Date(dateValue)
      date.setHours(timeValue.hours, timeValue.minutes, 0, 0)
      return date.getTime()
    }
    return dateValue
  }

  return 0
}

function parseDateValue(value?: string | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null

  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return parsed
  }

  const normalized = trimmed.replace(/\//g, '-').replace(/\./g, '-')
  const match = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (match) {
    const day = Number.parseInt(match[1], 10)
    const month = Number.parseInt(match[2], 10) - 1
    const rawYear = Number.parseInt(match[3], 10)
    const year = match[3].length === 2 ? 2000 + rawYear : rawYear
    const date = new Date(year, month, day)
    if (!Number.isNaN(date.getTime())) {
      return date.getTime()
    }
  }

  return null
}

function parseTimeValue(value?: string | null): { hours: number; minutes: number } | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})/) // 08:30, 8:30
  if (colonMatch) {
    const hours = Number.parseInt(colonMatch[1], 10)
    const minutes = Number.parseInt(colonMatch[2], 10)
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return { hours, minutes }
    }
  }

  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (ampmMatch) {
    let hours = Number.parseInt(ampmMatch[1], 10)
    const minutes = Number.parseInt(ampmMatch[2] ?? '0', 10)
    const modifier = ampmMatch[3]?.toLowerCase()
    if (modifier === 'pm' && hours < 12) {
      hours += 12
    }
    if (modifier === 'am' && hours === 12) {
      hours = 0
    }
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return { hours, minutes }
    }
  }

  const digitsMatch = trimmed.match(/^(\d{1,2})$/)
  if (digitsMatch) {
    const hours = Number.parseInt(digitsMatch[1], 10)
    if (!Number.isNaN(hours)) {
      return { hours, minutes: 0 }
    }
  }

  return null
}

function mapRowToTurnoRecord(row: Record<string, unknown>): TurnoRecord {
  const getString = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value
      }
    }
    return undefined
  }

  const worker =
    getString(
      'nombre',
      'Nombre',
      'trabajador',
      'trabajador_nombre',
      'nombre_trabajador',
      'worker',
      'operario',
      'empleado',
    ) ?? 'Sin asignar'
  const date = getString('fecha', 'Fecha', 'dia', 'date', 'fecha_jornada', 'fecha_registro')
  const entryTime = getString('hora_entrada', 'horaEntrada', 'HoraEntrada', 'entrada', 'hora')
  const status = getString('estado', 'status')
  const createdAt = getString(
    'insertado_en',
    'created_at',
    'inserted_at',
    'createdAt',
    'created',
    'timestamp',
    'fecha_creacion',
  )
  const fichadoField = row.fichado
  const fichado = typeof fichadoField === 'boolean' ? fichadoField : (status ?? '').toLowerCase().includes('fich')

  const primaryId = row.id
  const secondaryId = row.uuid
  const id =
    (typeof primaryId === 'string' && primaryId.length > 0)
      ? primaryId
      : (typeof secondaryId === 'string' && secondaryId.length > 0)
      ? secondaryId
      : (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2))

  return {
    id,
    worker,
    date,
    entryTime,
    status,
    fichado,
    createdAt,
    raw: row,
  }
}

function isRecordFichado(record: TurnoRecord): boolean {
  if (typeof record.fichado === 'boolean') return record.fichado
  return record.status?.toLowerCase().includes('fich') ?? false
}

function extractHour(value?: string): string {
  if (!value) return 'Sin hora'
  const match = value.match(/(\d{1,2})/)
  if (!match) return 'Sin hora'
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)))
  return `${hour.toString().padStart(2, '0')}:00`
}

function formatDate(value?: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)
  }
  return value
}

function formatTime(value?: string): string {
  if (!value) return '—'
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (match) {
    const hour = match[1].padStart(2, '0')
    return `${hour}:${match[2]}`
  }
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }
  return value
}

function renderTurnosChart(data: TurnosChartPoint[]) {
  const max = Math.max(...data.map((point) => point.count), 0)
  return data.map((point) => {
    const height = max > 0 ? Math.max((point.count / max) * 100, 6) : 6
    return (
      <div key={point.hour} className="flex flex-col items-center gap-1">
        <div
          className="w-8 rounded-lg bg-emerald-500"
          style={{ height: `${height}%` }}
        />
        <span className="text-xs font-medium text-gray-600">{point.hour}</span>
        <span className="text-[10px] text-gray-500">{point.count}</span>
      </div>
    )
  })
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'warning'
}) {
  const theme =
    tone === 'success'
      ? 'border-emerald-100 bg-emerald-50'
      : tone === 'warning'
      ? 'border-amber-100 bg-amber-50'
      : 'border-gray-200 bg-[#FAF9F6]'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${theme}`}>
      <p className="text-xs uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}
