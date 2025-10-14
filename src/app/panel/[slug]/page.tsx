'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import {
  AlertTriangle,
  BarChart,
  CheckCircle2,
  CreditCard,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Sprout,
  Tag,
  Trash2,
  UploadCloud,
  Workflow,
} from 'lucide-react'
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

interface LabelRecord {
  id: string
  fileName: string
  status?: string
  destination?: string
  labelCode?: string
  createdAt?: string
  updatedAt?: string
  pdfUrl?: string
  labelUrl?: string
  notes?: string
  storagePath?: string
  raw?: Record<string, unknown>
}

interface LabelUploadMeta {
  destination?: string
  notes?: string
  lote?: string
  fechaEnvasado?: string
  codigoCoc?: string
  codigoR?: string
}

interface UploadedFileAutomationFields {
  fechaEnvasado?: string | null
  lote?: string | null
  codigoCoc?: string | null
  codigoR?: string | null
}

interface UploadedFileAutomation {
  status: 'completed' | 'error'
  processedAt: string
  templateKey?: string | null
  confidence?: number | null
  fields?: UploadedFileAutomationFields
  model?: string | null
  notes?: string | null
  error?: string | null
  labelFileId?: string | null
  labelFileName?: string | null
  labelWebViewLink?: string | null
  labelWebContentLink?: string | null
  raw?: unknown
}

interface UploadedFileRecord {
  id: string
  name: string
  path: string
  size?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  publicUrl?: string | null
  destination?: string | null
  notes?: string | null
  mimeType?: string | null
  automation?: UploadedFileAutomation | null
  generatedFromFileId?: string | null
}

type LabelStatusTone = 'pending' | 'success' | 'error' | 'info'

type TurnosDownloadRange = 'day' | 'week' | 'month' | 'year'

const TURNOS_RECENT_LIMIT = 8
const TURNOS_FETCH_LIMIT = 32
const LABELS_FETCH_LIMIT = 100
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
  const [labelsData, setLabelsData] = useState<LabelRecord[]>([])
  const [labelsLoading, setLabelsLoading] = useState(false)
  const [labelsError, setLabelsError] = useState<string | null>(null)
  const [labelsActiveTable, setLabelsActiveTable] = useState<string | null>(null)
  const [labelUploadLoading, setLabelUploadLoading] = useState(false)
  const [labelUploadError, setLabelUploadError] = useState<string | null>(null)
  const [labelUploadMessage, setLabelUploadMessage] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([])
  const [uploadedFilesLoading, setUploadedFilesLoading] = useState(false)
  const [uploadedFilesError, setUploadedFilesError] = useState<string | null>(null)
  const [uploadedFilesMessage, setUploadedFilesMessage] = useState<string | null>(null)
  const [uploadedFilesDeletingId, setUploadedFilesDeletingId] = useState<string | null>(null)
  const [uploadedFilesFolder, setUploadedFilesFolder] = useState<string | null>(null)
  const userEmail = user?.email ?? ''
  const userDisplayName = useMemo(() => {
    const atIndex = userEmail.indexOf('@')
    return atIndex === -1 ? userEmail : userEmail.slice(0, atIndex)
  }, [userEmail])

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error('Error al recuperar la sesión, cerrando sesión por seguridad.', error)
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

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
  const isLabelsPanel = panelConfig.slug === 'etiquetas'

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
  const labelsPlan = useMemo(
    () => activePlans.find((plan) => plan.dataset?.type === 'labels'),
    [activePlans],
  )
  const labelsHistoryDisabled = labelsPlan?.dataset?.historyDisabled ?? false

  useEffect(() => {
    const dataset = turnosPlan?.dataset
    if (!dataset) {
      setTurnosActiveTable(null)
      return
    }

    setTurnosActiveTable((current) => current ?? dataset.table)
  }, [turnosPlan])

  useEffect(() => {
    const dataset = labelsPlan?.dataset
    if (!dataset) {
      setLabelsActiveTable(null)
      return
    }

    if (dataset.historyDisabled) {
      setLabelsActiveTable(null)
      return
    }

    setLabelsActiveTable((current) => current ?? dataset.table)
  }, [labelsPlan])

  const loadTurnos = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!turnosPlan?.dataset || !user) return

      const silent = options?.silent ?? false

      if (!silent) {
        setTurnosLoading(true)
      }

      const dataset = turnosPlan.dataset
      const filters = getDatasetFilters(dataset, user, userEmail)

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

            for (const filter of filters) {
              queryBuilder = queryBuilder.eq(filter.column, filter.value)
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
    [supabase, turnosActiveTable, turnosPlan, user, userEmail],
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

    const filters = getDatasetFilters(turnosPlan.dataset, user, userEmail)
    const realtimeFilter = buildRealtimeFilter(filters)

    const channel = supabase
      .channel(`turnos-${turnosActiveTable}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: turnosActiveTable,
          ...(realtimeFilter ? { filter: realtimeFilter } : {}),
        },
        () => {
          loadTurnos({ silent: true })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTurnos, supabase, turnosActiveTable, turnosPlan?.dataset, user, userEmail])

  const loadLabels = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!labelsPlan?.dataset || !user) return

      const silent = options?.silent ?? false

      if (!silent) {
        setLabelsLoading(true)
      }

      try {
        const dataset = labelsPlan.dataset
        if (dataset.historyDisabled) {
          setLabelsActiveTable(null)
          setLabelsError(null)
          setLabelsData([])
          return
        }
        const baseTable = dataset.table
        const insertTable = dataset.insertTable
        const fallbacks = dataset.fallbackTables ?? []
        const filters = getDatasetFilters(dataset, user, userEmail)

        const candidateTables = [
          baseTable,
          labelsActiveTable,
          insertTable,
          ...fallbacks,
        ].filter((value): value is string => typeof value === 'string' && value.length > 0)

        const tablesToTry = Array.from(new Set(candidateTables))
        const orderPreferences = buildOrderPreferences(dataset.orderBy)

        let chosenTable: string | null = null
        let chosenData: LabelRecord[] | null = null
        let encounteredEmpty = false
        let lastErrorMessage: string | null = null
        let missingTableMessage: string | null = null

        tableLoop: for (const tableName of tablesToTry) {
          const orderSets = orderPreferences.length > 0 ? orderPreferences : [[]]

          for (const orders of orderSets) {
            let queryBuilder = supabase.from(tableName).select('*')

            for (const filter of filters) {
              queryBuilder = queryBuilder.eq(filter.column, filter.value)
            }

            for (const order of orders) {
              queryBuilder = queryBuilder.order(order.column, {
                ascending: order.ascending ?? false,
                nullsFirst: order.nullsFirst,
              })
            }

            const { data, error } = await queryBuilder.limit(LABELS_FETCH_LIMIT)

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

            const mapped = (data ?? []).map(mapRowToLabelRecord)

            if (mapped.length === 0) {
              encounteredEmpty = true
              if (!chosenTable) {
                chosenTable = tableName
                chosenData = []
              }
              continue tableLoop
            }

            chosenTable = tableName
            chosenData = mapped
            encounteredEmpty = false
            break tableLoop
          }
        }

        if (chosenTable && chosenData && chosenData.length > 0) {
          setLabelsActiveTable(chosenTable)
          setLabelsError(null)
          setLabelsData(chosenData)
          return
        }

        if (encounteredEmpty) {
          const fallbackTable = chosenTable ?? tablesToTry[0] ?? dataset.table ?? null
          if (fallbackTable) {
            setLabelsActiveTable(fallbackTable)
          }
          setLabelsError(null)
          setLabelsData(chosenData ?? [])
          return
        }

        const message = missingTableMessage && tablesToTry.length > 0
          ? `No encontramos las tablas configuradas (${tablesToTry.join(
              ', '
            )}). Revisa que existan en Supabase o ajusta la configuración.`
          : lastErrorMessage ??
            'No se pudo cargar el historial de etiquetas. Intenta de nuevo en unos segundos.'
        setLabelsError(message)
        setLabelsData([])
      } catch (error) {
        setLabelsError((error as Error).message)
        setLabelsData([])
      } finally {
        if (!silent) {
          setLabelsLoading(false)
        }
      }
    },
    [labelsActiveTable, labelsPlan, supabase, user, userEmail],
  )

  const loadUploadedFiles = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!labelsPlan?.dataset || !user) return

      const silent = options?.silent ?? false
      const dataset = labelsPlan.dataset
      const normalizeFolder = (value: string): string =>
        value.trim().replace(/^\/+/, '').replace(/\/+$/, '')
      const configuredFolder =
        typeof dataset.storageFolder === 'string' && dataset.storageFolder.length > 0
          ? normalizeFolder(dataset.storageFolder)
          : ''

      if (!silent) {
        setUploadedFilesLoading(true)
      }
      setUploadedFilesError(null)

      try {
        const params = new URLSearchParams()
        if (configuredFolder) {
          params.set('folder', configuredFolder)
        }

        const query = params.toString()
        const response = await fetch(`/api/storage/uploads${query ? `?${query}` : ''}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          const message =
            typeof body.error === 'string'
              ? body.error
              : 'No se pudieron obtener los archivos almacenados.'
          throw new Error(message)
        }

        const body = (await response.json().catch(() => ({}))) as {
          files?: Array<{
            id?: string
            name?: string
            size?: number | string | null
            createdAt?: string | null
            updatedAt?: string | null
            webViewLink?: string | null
            webContentLink?: string | null
            description?: string | null
            mimeType?: string | null
          }>
        }

        const files = Array.isArray(body.files) ? body.files : []
        const mapped = files
          .filter((file) => typeof file?.id === 'string' && (file?.name?.length ?? 0) > 0)
          .map<UploadedFileRecord>((file) => {
            const id = file.id as string
            const name = file.name as string
            const sizeValue = file.size
            const size =
              typeof sizeValue === 'number'
                ? sizeValue
                : typeof sizeValue === 'string'
                ? Number(sizeValue)
                : null
            const publicUrl = file.webViewLink ?? file.webContentLink ?? null
            const mimeType = file.mimeType ?? null

            let destination: string | null = null
            let notes: string | null = null
            let automation: UploadedFileAutomation | null = null
            let generatedFromFileId: string | null = null
            if (typeof file.description === 'string' && file.description.trim().length > 0) {
              try {
                const parsed = JSON.parse(file.description)
                if (parsed && typeof parsed === 'object') {
                  if (typeof parsed.destination === 'string') {
                    destination = parsed.destination
                  }
                  if (typeof parsed.notes === 'string') {
                    notes = parsed.notes
                  }
                  if (parsed.automation && typeof parsed.automation === 'object') {
                    const automationPayload = parsed.automation as Record<string, unknown>
                    const status = automationPayload.status
                    const processedAtValue = automationPayload.processedAt
                    if (
                      (status === 'completed' || status === 'error') &&
                      (typeof processedAtValue === 'string' || processedAtValue instanceof Date)
                    ) {
                      const fieldsPayload =
                        automationPayload.fields && typeof automationPayload.fields === 'object'
                          ? (automationPayload.fields as Record<string, unknown>)
                          : null

                      const processedAt =
                        processedAtValue instanceof Date
                          ? processedAtValue.toISOString()
                          : typeof processedAtValue === 'string'
                          ? processedAtValue
                          : new Date().toISOString()

                      automation = {
                        status,
                        processedAt,
                        templateKey:
                          typeof automationPayload.templateKey === 'string'
                            ? automationPayload.templateKey
                            : null,
                        confidence:
                          typeof automationPayload.confidence === 'number'
                            ? automationPayload.confidence
                            : null,
                        model:
                          typeof automationPayload.model === 'string'
                            ? automationPayload.model
                            : null,
                        notes:
                          typeof automationPayload.notes === 'string'
                            ? automationPayload.notes
                            : null,
                        error:
                          typeof automationPayload.error === 'string'
                            ? automationPayload.error
                            : null,
                        labelFileId:
                          typeof automationPayload.labelFileId === 'string'
                            ? automationPayload.labelFileId
                            : null,
                        labelFileName:
                          typeof automationPayload.labelFileName === 'string'
                            ? automationPayload.labelFileName
                            : null,
                        labelWebViewLink:
                          typeof automationPayload.labelWebViewLink === 'string'
                            ? automationPayload.labelWebViewLink
                            : null,
                        labelWebContentLink:
                          typeof automationPayload.labelWebContentLink === 'string'
                            ? automationPayload.labelWebContentLink
                            : null,
                        raw: automationPayload.raw,
                      }

                      if (fieldsPayload) {
                        automation.fields = {
                          fechaEnvasado:
                            typeof fieldsPayload.fechaEnvasado === 'string'
                              ? fieldsPayload.fechaEnvasado
                              : null,
                          lote:
                            typeof fieldsPayload.lote === 'string'
                              ? fieldsPayload.lote
                              : null,
                          codigoCoc:
                            typeof fieldsPayload.codigoCoc === 'string'
                              ? fieldsPayload.codigoCoc
                              : null,
                          codigoR:
                            typeof fieldsPayload.codigoR === 'string'
                              ? fieldsPayload.codigoR
                              : null,
                        }
                      }
                    }
                    }
                  if (typeof parsed.generatedFromFileId === 'string') {
                    generatedFromFileId = parsed.generatedFromFileId
                  }
                }
              } catch {
                // ignore malformed description payloads
              }
            }

            const path =
              configuredFolder && configuredFolder.length > 0
                ? `${configuredFolder}/${name}`
                : name

            const record: UploadedFileRecord = {
              id,
              name,
              path,
              size,
              createdAt: file.createdAt ?? null,
              updatedAt: file.updatedAt ?? null,
              publicUrl,
              mimeType,
              generatedFromFileId,
            }

            if (destination || notes) {
              record.destination = destination
              record.notes = notes
            }
            if (generatedFromFileId) {
              record.generatedFromFileId = generatedFromFileId
              if (!record.notes) {
                record.notes = 'Generada automáticamente desde el albarán original.'
              } else if (!record.notes.includes('Generada automáticamente')) {
                record.notes = `${record.notes} (Generada automáticamente)`
              }
            }
            if (automation) {
              record.automation = automation
            }

            return record
          })

        const filtered = mapped.filter((record) => !record.generatedFromFileId)
        setUploadedFiles(filtered)
        setUploadedFilesFolder(configuredFolder)
      } catch (error) {
        setUploadedFilesError((error as Error).message)
        setUploadedFiles([])
        setUploadedFilesFolder(configuredFolder || null)
      } finally {
        if (!silent) {
          setUploadedFilesLoading(false)
        }
      }
    },
    [labelsPlan, user],
  )

  useEffect(() => {
    if (!labelsPlan || !user) return
    if (labelsPlan.dataset?.historyDisabled) {
      setLabelsError(null)
      setLabelsData([])
      return
    }
    loadLabels()
  }, [labelsPlan, loadLabels, user])

  useEffect(() => {
    if (!labelsPlan?.dataset || !user) return

    const dataset = labelsPlan.dataset
    if (dataset.historyDisabled) return

    const table =
      (labelsActiveTable && labelsActiveTable.length > 0 ? labelsActiveTable : null) ??
      dataset.table
    if (!table) return

    const filters = getDatasetFilters(dataset, user, userEmail)
    const realtimeFilter = buildRealtimeFilter(filters)

    const channel = supabase
      .channel(`labels-${table}-${user.id ?? 'anon'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(realtimeFilter ? { filter: realtimeFilter } : {}),
        },
        () => {
          loadLabels({ silent: true })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [labelsActiveTable, labelsPlan?.dataset, loadLabels, supabase, user, userEmail])

  useEffect(() => {
    if (!labelsPlan?.dataset || !user) {
      setUploadedFiles([])
      setUploadedFilesError(null)
      setUploadedFilesMessage(null)
      setUploadedFilesDeletingId(null)
      setUploadedFilesFolder(null)
      return
    }
    loadUploadedFiles()
  }, [labelsPlan, loadUploadedFiles, user])

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
        const filters = getDatasetFilters(dataset, user, userEmail)

        let success = false
        let lastErrorMessage: string | null = null
        let rows: string[][] = []

        tableLoop: for (const tableName of tablesToTry) {
          const orderSets = orderPreferences.length > 0 ? orderPreferences : [[]]

          for (const orders of orderSets) {
            const rangeOptions = rangeColumns.length > 0 ? rangeColumns : [null]

            for (const rangeColumn of rangeOptions) {
              let queryBuilder = supabase.from(tableName).select('*')

              for (const filter of filters) {
                queryBuilder = queryBuilder.eq(filter.column, filter.value)
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
    [supabase, turnosActiveTable, turnosPlan, user, userEmail],
  )

  const handleUploadLabel = useCallback(
    async (file: File, meta?: LabelUploadMeta) => {
      if (!labelsPlan?.dataset || !user) {
        setLabelUploadError('No encontramos la configuración de etiquetas. Vuelve a iniciar sesión.')
        return
      }

      if (!file) {
        setLabelUploadError('Selecciona un archivo antes de subirlo.')
        return
      }

      const fileName = file.name ?? 'albaran.png'
      const normalizedName = fileName.toLowerCase()
      const mimeType = file.type?.toLowerCase() ?? ''
      const allowedMimeTypes = new Set([
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/heic',
        'image/heif',
        'image/gif',
      ])
      const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif']
      const isAllowed =
        allowedMimeTypes.has(mimeType) ||
        allowedExtensions.some((extension) => normalizedName.endsWith(extension))

      if (!isAllowed) {
        setLabelUploadError(
          'Solo se admiten imágenes (PNG, JPG, WebP, HEIC, GIF). Convierte el albarán a imagen antes de subirlo.',
        )
        return
      }

      setLabelUploadError(null)
      setLabelUploadMessage(null)
      setUploadedFilesMessage(null)
      setLabelUploadLoading(true)

      try {
        const dataset = labelsPlan.dataset
        const folderId =
          typeof dataset.storageFolder === 'string' ? dataset.storageFolder.trim() : ''

        const formData = new FormData()
        formData.append('file', file)
        if (folderId.length > 0) {
          formData.append('folder', folderId)
        }
        if (meta?.destination) {
          formData.append('destination', meta.destination)
        }
        if (meta?.notes) {
          formData.append('notes', meta.notes)
        }
        if (meta?.lote) {
          formData.append('manualLote', meta.lote)
        }
        if (meta?.fechaEnvasado) {
          formData.append('manualFechaEnvasado', meta.fechaEnvasado)
        }
        if (meta?.codigoCoc) {
          formData.append('manualCodigoCoc', meta.codigoCoc)
        }
        if (meta?.codigoR) {
          formData.append('manualCodigoR', meta.codigoR)
        }
        if (userEmail.length > 0) {
          formData.append('userEmail', userEmail)
        }

        const response = await fetch('/api/storage/uploads', {
          method: 'POST',
          body: formData,
        })

        const body = (await response.json().catch(() => ({}))) as {
          error?: string
          automationError?: string | null
          automation?:
            | {
                status?: string
                fields?: {
                  fechaEnvasado?: string | null
                  lote?: string | null
                  codigoCoc?: string | null
                  codigoR?: string | null
                }
                labelFileName?: string | null
                labelWebViewLink?: string | null
                labelWebContentLink?: string | null
              }
            | null
        }

        if (!response.ok) {
          const message =
            typeof body.error === 'string'
              ? body.error
              : 'No se pudo subir el archivo. Intenta nuevamente.'
          throw new Error(message)
        }

        const automationError =
          typeof body.automationError === 'string' && body.automationError.trim().length > 0
            ? body.automationError.trim()
            : null
        const automationFields = body.automation?.fields ?? null
        const automationLabelName =
          typeof body.automation?.labelFileName === 'string' &&
          body.automation.labelFileName.trim().length > 0
            ? body.automation.labelFileName.trim()
            : null
        const automationLabelLink =
          typeof body.automation?.labelWebViewLink === 'string' &&
          body.automation.labelWebViewLink.trim().length > 0
            ? body.automation.labelWebViewLink.trim()
            : typeof body.automation?.labelWebContentLink === 'string' &&
              body.automation.labelWebContentLink.trim().length > 0
            ? body.automation.labelWebContentLink.trim()
            : null

        if (automationError) {
          setLabelUploadMessage(
            `Archivo "${fileName}" subido, pero la automatización falló: ${automationError}`,
          )
        } else {
          const extractedParts = automationFields
            ? [
                automationFields.fechaEnvasado
                  ? `Envasado: ${automationFields.fechaEnvasado}`
                  : null,
                automationFields.lote ? `Lote: ${automationFields.lote}` : null,
                automationFields.codigoCoc ? `COC: ${automationFields.codigoCoc}` : null,
                automationFields.codigoR ? `R: ${automationFields.codigoR}` : null,
              ].filter((part): part is string => typeof part === 'string' && part.length > 0)
            : []

          const extractedMessage = automationFields
            ? extractedParts.length > 0
              ? `Datos extraídos → ${extractedParts.join(' · ')}.`
              : 'No se detectaron datos en la etiqueta.'
            : null

          if (automationLabelName || automationLabelLink) {
            const segments = [
              `Archivo "${fileName}" subido.`,
              extractedMessage,
              `Etiqueta PDF generada: ${automationLabelName ?? 'consulta el historial'}.`,
            ].filter((segment): segment is string => typeof segment === 'string' && segment.length > 0)

            setLabelUploadMessage(segments.join(' '))
          } else if (extractedMessage) {
            setLabelUploadMessage(`Archivo "${fileName}" subido. ${extractedMessage}`)
          } else {
            setLabelUploadMessage(`Archivo "${fileName}" subido correctamente.`)
          }
        }
        setUploadedFilesMessage(`Archivo añadido al historial: ${fileName}`)
        await loadUploadedFiles({ silent: true })
      } catch (error) {
        setLabelUploadError((error as Error).message)
      } finally {
        setLabelUploadLoading(false)
      }
    },
    [labelsPlan, loadUploadedFiles, user, userEmail],
  )

  const handleDeleteUploadedFile = useCallback(
    async (file: UploadedFileRecord) => {
      if (!labelsPlan?.dataset || !user) {
        setUploadedFilesError('No encontramos la configuración de archivos. Vuelve a iniciar sesión.')
        return
      }

      if (!file.id) {
        setUploadedFilesError('No pudimos identificar el archivo a eliminar.')
        return
      }

      setUploadedFilesError(null)
      setUploadedFilesMessage(null)
      setUploadedFilesDeletingId(file.id)

      try {
        const response = await fetch('/api/storage/uploads', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: file.id }),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          const message =
            typeof body.error === 'string'
              ? body.error
              : 'No se pudo eliminar el archivo. Intenta nuevamente.'
          throw new Error(message)
        }

        setUploadedFilesMessage(`Archivo eliminado del historial: ${file.name}`)
        await loadUploadedFiles({ silent: true })
      } catch (error) {
        setUploadedFilesError((error as Error).message)
      } finally {
        setUploadedFilesDeletingId(null)
      }
    },
    [labelsPlan, loadUploadedFiles, user],
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
                {userDisplayName || user.email}
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
          {!isLabelsPanel && (
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
          )}

          {!isLabelsPanel && (
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
          )}

          <section className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">Mi panel</h2>
                <p className="mt-2 text-sm text-gray-600">
                  {isLabelsPanel
                    ? 'Sube los albaranes en imagen, genera la etiqueta automática y revisa el historial enviado al almacén.'
                    : 'Visualiza las automatizaciones activas y descarga reportes de turnos, inventario o tratamientos al instante.'}
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
                    ) : plan.dataset?.type === 'labels' ? (
                      <LabelsDashboard
                        data={labelsData}
                        loading={labelsLoading}
                        historyError={labelsError}
                        formError={labelUploadError}
                        successMessage={labelUploadMessage}
                        uploading={labelUploadLoading}
                        onUpload={handleUploadLabel}
                        onRefresh={() => loadLabels()}
                        historyDisabled={labelsHistoryDisabled}
                        uploads={uploadedFiles}
                        uploadsLoading={uploadedFilesLoading}
                        uploadsError={uploadedFilesError}
                        uploadsMessage={uploadedFilesMessage}
                        uploadsDeletingId={uploadedFilesDeletingId}
                        uploadsFolder={uploadedFilesFolder}
                        onReloadUploads={() => loadUploadedFiles()}
                        onDeleteUpload={handleDeleteUploadedFile}
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

          {!isLabelsPanel &&
            sections.map((section) => (
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

          {!isLabelsPanel && (
            <MarketplaceSection
              templates={filteredTemplates}
              query={query}
              onQueryChange={setQuery}
            />
          )}

          {!isLabelsPanel && <CTASection detail={detail} />}
        </div>
      </main>
    </div>
  )
}

function LabelsDashboard({
  data,
  loading,
  historyError,
  formError,
  successMessage,
  uploading,
  onUpload,
  onRefresh,
  historyDisabled,
  uploads,
  uploadsLoading,
  uploadsError,
  uploadsMessage,
  uploadsDeletingId,
  uploadsFolder,
  onReloadUploads,
  onDeleteUpload,
}: {
  data: LabelRecord[]
  loading: boolean
  historyError: string | null
  formError: string | null
  successMessage: string | null
  uploading: boolean
  onUpload: (file: File, meta?: LabelUploadMeta) => void | Promise<void>
  onRefresh: () => void | Promise<void>
  historyDisabled: boolean
  uploads: UploadedFileRecord[]
  uploadsLoading: boolean
  uploadsError: string | null
  uploadsMessage: string | null
  uploadsDeletingId: string | null
  uploadsFolder: string | null
  onReloadUploads: () => void | Promise<void>
  onDeleteUpload: (file: UploadedFileRecord) => void | Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [destination, setDestination] = useState('')
  const [notes, setNotes] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [manualLote, setManualLote] = useState('')
  const [manualFechaEnvasado, setManualFechaEnvasado] = useState('')
  const [manualCodigoCoc, setManualCodigoCoc] = useState('')
  const [manualCodigoR, setManualCodigoR] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem('labels:manual-fields')
      if (!stored) return
      const parsed = JSON.parse(stored) as Partial<LabelUploadMeta>
      if (typeof parsed?.lote === 'string') {
        setManualLote(parsed.lote)
      }
      if (typeof parsed?.fechaEnvasado === 'string') {
        setManualFechaEnvasado(parsed.fechaEnvasado)
      }
      if (typeof parsed?.codigoCoc === 'string') {
        setManualCodigoCoc(parsed.codigoCoc)
      }
      if (typeof parsed?.codigoR === 'string') {
        setManualCodigoR(parsed.codigoR)
      }
    } catch {
      // ignore malformed storage values
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload: LabelUploadMeta = {
      lote: manualLote,
      fechaEnvasado: manualFechaEnvasado,
      codigoCoc: manualCodigoCoc,
      codigoR: manualCodigoR,
    }
    try {
      window.localStorage.setItem('labels:manual-fields', JSON.stringify(payload))
    } catch {
      // ignore storage quota issues
    }
  }, [manualCodigoCoc, manualCodigoR, manualFechaEnvasado, manualLote])


  const resetForm = useCallback(() => {
    setFile(null)
    setDestination('')
    setNotes('')
    setLocalError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  useEffect(() => {
    if (successMessage && !uploading) {
      resetForm()
    }
  }, [resetForm, successMessage, uploading])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    setFile(nextFile)
    if (nextFile) {
      setLocalError(null)
    }
  }, [])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!file) {
        setLocalError('Selecciona un archivo antes de subirlo.')
        return
      }
      setLocalError(null)

      const meta: LabelUploadMeta = {}
      if (destination.trim().length > 0) {
        meta.destination = destination.trim()
      }
      if (notes.trim().length > 0) {
        meta.notes = notes.trim()
      }
      if (manualLote.trim().length > 0) {
        meta.lote = manualLote.trim()
      }
      if (manualFechaEnvasado.trim().length > 0) {
        meta.fechaEnvasado = manualFechaEnvasado.trim()
      }
      if (manualCodigoCoc.trim().length > 0) {
        meta.codigoCoc = manualCodigoCoc.trim()
      }
      if (manualCodigoR.trim().length > 0) {
        meta.codigoR = manualCodigoR.trim()
      }

      await onUpload(file, meta)
    },
    [
      destination,
      file,
      manualCodigoCoc,
      manualCodigoR,
      manualFechaEnvasado,
      manualLote,
      notes,
      onUpload,
    ],
  )

  const combinedError = localError ?? formError

  const handleRefreshClick = useCallback(() => {
    onRefresh()
  }, [onRefresh])

  const handleDeleteUpload = useCallback(
    (file: UploadedFileRecord) => {
      const confirmed = window.confirm(
        `¿Seguro que quieres eliminar el archivo "${file.name}" del almacenamiento? Esta acción no se puede deshacer.`,
      )
      if (!confirmed) return
      void onDeleteUpload(file)
    },
    [onDeleteUpload],
  )

  const handleReloadUploads = useCallback(() => {
    void onReloadUploads()
  }, [onReloadUploads])

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-dashed border-gray-300 bg-[#FAF9F6] p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-[#FAF9F6]">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Subir albarán en imagen</h4>
                <p className="text-sm text-gray-600">
                  Guardamos la imagen de manera segura para que el flujo pueda procesarla y generar la
                  etiqueta automáticamente.
                </p>
              </div>
            </header>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
                <button
                  type="submit"
                  disabled={uploading}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    uploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:opacity-90'
                  }`}
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploading ? 'Subiendo…' : 'Subir archivo'}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Destino (opcional)
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="Ej. Almacén central, campaña cítricos"
                    disabled={uploading}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Notas para el flujo
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Añade contexto para n8n o el almacén"
                    disabled={uploading}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Datos manuales para la etiqueta
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Estos valores se aplicarán a todas las etiquetas generadas hasta que los cambies.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Lote</label>
                    <input
                      type="text"
                      value={manualLote}
                      onChange={(event) => setManualLote(event.target.value)}
                      placeholder="Ej. LOTE-20241014-01"
                      disabled={uploading}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Fecha de envasado</label>
                    <input
                      type="date"
                      value={manualFechaEnvasado}
                      onChange={(event) => setManualFechaEnvasado(event.target.value)}
                      disabled={uploading}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Código COC</label>
                    <input
                      type="text"
                      value={manualCodigoCoc}
                      onChange={(event) => setManualCodigoCoc(event.target.value)}
                      placeholder="Ej. COC 123456"
                      disabled={uploading}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Código R</label>
                    <input
                      type="text"
                      value={manualCodigoR}
                      onChange={(event) => setManualCodigoR(event.target.value)}
                      placeholder="Ej. R-123456"
                      disabled={uploading}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                </div>
              </div>

              {combinedError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
                  {combinedError}
                </p>
              )}

              {successMessage && !combinedError && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
                  {successMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      </section>

      {historyDisabled ? (
        <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Archivos subidos</h4>
              <p className="text-sm text-gray-600">
                Mostramos los archivos disponibles en tu historial.
                {uploadsFolder !== null && (
                  <span className="block text-xs text-gray-500 mt-1">
                    Carpeta {uploadsFolder.length === 0 ? 'principal' : uploadsFolder}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReloadUploads}
              disabled={uploadsLoading}
              className={`inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium transition ${
                uploadsLoading ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${uploadsLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </header>

          <div className="mt-5">
            {uploadsMessage && !uploadsError && (
              <p className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
                {uploadsMessage}
              </p>
            )}
            {uploadsError ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
                {uploadsError}
              </p>
            ) : uploadsLoading && uploads.length === 0 ? (
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando archivos del historial…
              </p>
            ) : uploads.length === 0 ? (
              <p className="text-sm text-gray-600">
                Aún no subes ninguna imagen. Sube tu primer albarán para verlo listado aquí.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-[#FAF9F6] text-gray-500 uppercase tracking-wide text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">Archivo</th>
                      <th className="px-4 py-3 text-left">Tamaño</th>
                      <th className="px-4 py-3 text-left">Subido</th>
                      <th className="px-4 py-3 text-left">Actualizado</th>
                      <th className="px-4 py-3 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {uploads.map((file) => {
                      const isDeleting = uploadsDeletingId === file.id
                      const automation = file.automation ?? null
                      const automationStatusLabel =
                        automation?.status === 'completed'
                          ? 'Automatización completada'
                          : automation?.status === 'error'
                          ? 'Automatización con errores'
                          : null
                      const extractedFields = automation?.fields ?? null
                      return (
                        <tr key={file.id} className="hover:bg-[#FAF9F6] transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-900 truncate max-w-[220px]">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5 break-all">{file.path}</p>
                                {file.destination && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Destino: {file.destination}
                                  </p>
                                )}
                                {file.notes && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Notas: {file.notes}
                                  </p>
                                )}
                                {file.generatedFromFileId && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    Origen: {formatShortId(file.generatedFromFileId)}
                                  </p>
                                )}
                                {automation && (
                                  <div className="mt-2 space-y-1">
                                    {automationStatusLabel && (
                                      <p
                                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${
                                          automation.status === 'completed'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-amber-50 text-amber-700'
                                        }`}
                                      >
                                        {automationStatusLabel}
                                        {typeof automation.confidence === 'number' && (
                                          <span className="text-[10px] uppercase tracking-wide">
                                            Confianza {Math.round(automation.confidence * 100)}%
                                          </span>
                                        )}
                                      </p>
                                    )}
                                    <div className="text-xs text-gray-500 space-y-0.5">
                                      {automation.templateKey && (
                                        <p>Plantilla detectada: {automation.templateKey}</p>
                                      )}
                                      {extractedFields &&
                                        (extractedFields.fechaEnvasado ||
                                          extractedFields.lote ||
                                          extractedFields.codigoCoc ||
                                          extractedFields.codigoR) && (
                                          <p className="flex flex-wrap gap-2">
                                            {extractedFields.fechaEnvasado && (
                                              <span className="inline-flex items-center rounded-full bg-gray-200/70 px-2 py-0.5">
                                                Envasado {extractedFields.fechaEnvasado}
                                              </span>
                                            )}
                                            {extractedFields.lote && (
                                              <span className="inline-flex items-center rounded-full bg-gray-200/70 px-2 py-0.5">
                                                Lote {extractedFields.lote}
                                              </span>
                                            )}
                                            {extractedFields.codigoCoc && (
                                              <span className="inline-flex items-center rounded-full bg-gray-200/70 px-2 py-0.5">
                                                COC {extractedFields.codigoCoc}
                                              </span>
                                            )}
                                            {extractedFields.codigoR && (
                                              <span className="inline-flex items-center rounded-full bg-gray-200/70 px-2 py-0.5">
                                                R {extractedFields.codigoR}
                                              </span>
                                            )}
                                          </p>
                                        )}
                                      {automation.error && (
                                        <p className="text-red-600">
                                          Error: {automation.error}
                                        </p>
                                      )}
                                      {automation.notes && (
                                        <p className="italic">Notas: {automation.notes}</p>
                                      )}
                                      {(automation.labelWebViewLink ||
                                        automation.labelWebContentLink) && (
                                        <p className="pt-0.5">
                                          <a
                                            href={
                                              automation.labelWebViewLink ??
                                              automation.labelWebContentLink ??
                                              '#'
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900 underline"
                                          >
                                            Ver etiqueta generada
                                            {automation.labelFileName
                                              ? ` (${automation.labelFileName})`
                                              : ''}
                                          </a>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {file.size != null ? formatBytes(file.size) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDateTime(file.createdAt ?? file.updatedAt ?? undefined)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {file.updatedAt ? formatDateTime(file.updatedAt) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex flex-wrap items-center gap-2">
                              {(file.publicUrl || automation?.labelWebViewLink || automation?.labelWebContentLink) ? (
                                <details className="relative group">
                                  <summary className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 cursor-pointer list-none">
                                    Abrir
                                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                                  </summary>
                                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                    {file.publicUrl ? (
                                      <a
                                        href={file.publicUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                      >
                                        Pedido original
                                        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                                      </a>
                                    ) : null}
                                    {automation?.labelWebViewLink || automation?.labelWebContentLink ? (
                                      <a
                                        href={automation.labelWebViewLink ?? automation.labelWebContentLink ?? '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                      >
                                        PDF etiqueta
                                        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                                      </a>
                                    ) : null}
                                  </div>
                                </details>
                              ) : (
                                <span className="text-gray-400">Sin enlace</span>
                              )}
                        <button
                          type="button"
                          onClick={() => handleDeleteUpload(file)}
                          disabled={isDeleting}
                          className={`inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium transition ${
                                  isDeleting
                                    ? 'cursor-not-allowed text-gray-400 bg-gray-100'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                {isDeleting ? 'Eliminando…' : 'Eliminar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section
          id="historial-etiquetas"
          className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm"
        >
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Historial de etiquetas</h4>
              <p className="text-sm text-gray-600">
                Revisamos el estado devuelto por n8n y las etiquetas generadas para cada albarán.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={loading}
              className={`inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium transition ${
                loading ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </header>

          <div className="mt-5">
            {historyError ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
                {historyError}
              </p>
            ) : loading && data.length === 0 ? (
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando historial desde Supabase…
              </p>
            ) : data.length === 0 ? (
              <p className="text-sm text-gray-600">
                Aún no hay etiquetas registradas. Sube tu primer albarán en imagen para iniciar el flujo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-[#FAF9F6] text-gray-500 uppercase tracking-wide text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">Archivo</th>
                      <th className="px-4 py-3 text-left">Destino</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Etiqueta</th>
                      <th className="px-4 py-3 text-left">Creado</th>
                      <th className="px-4 py-3 text-left">Actualizado</th>
                      <th className="px-4 py-3 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {data.map((record) => {
                      const statusMeta = getLabelStatusMeta(record.status)
                      return (
                        <tr key={record.id} className="hover:bg-[#FAF9F6] transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-900 truncate max-w-[220px]">
                                  {record.fileName || 'Archivo sin nombre'}
                                </p>
                                {record.notes && (
                                  <p className="text-xs text-gray-500 mt-0.5">{record.notes}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.destination ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                                statusMeta.tone === 'success'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : statusMeta.tone === 'error'
                                  ? 'bg-red-50 text-red-700'
                                  : statusMeta.tone === 'pending'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-sky-50 text-sky-700'
                              }`}
                            >
                              {statusMeta.tone === 'success' && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {statusMeta.tone === 'error' && <AlertTriangle className="h-3.5 w-3.5" />}
                              {statusMeta.tone === 'pending' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {statusMeta.tone === 'info' && <Tag className="h-3.5 w-3.5" />}
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.labelCode ?? (record.labelUrl ? 'Generada' : '—')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDateTime(record.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDateTime(record.updatedAt)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              {record.pdfUrl && (
                                <a
                                  href={record.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Ver archivo
                                </a>
                              )}
                              {record.labelUrl && (
                                <a
                                  href={record.labelUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                                >
                                  <Tag className="h-3.5 w-3.5" />
                                  Descargar etiqueta
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return `${bytes} B`
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function formatShortId(value?: string | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length <= 10) return trimmed
  return `…${trimmed.slice(-8)}`
}

function getLabelStatusMeta(status?: string | null): { label: string; tone: LabelStatusTone } {
  if (!status) {
    return { label: 'Pendiente', tone: 'pending' }
  }

  const normalized = status.toLowerCase().trim()

  if (normalized.includes('error') || normalized.includes('fall')) {
    return { label: status, tone: 'error' }
  }

  if (
    normalized.includes('envi') ||
    normalized.includes('notific') ||
    normalized.includes('final') ||
    normalized.includes('listo')
  ) {
    return { label: status, tone: 'success' }
  }

  if (normalized.includes('proces')) {
    return { label: status, tone: 'info' }
  }

  if (normalized.includes('pend')) {
    return { label: status, tone: 'pending' }
  }

  return { label: status, tone: 'info' }
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

function getDatasetFilters(
  dataset: PanelPlanDatasetConfig | undefined,
  user: User | null,
  userEmail: string,
): Array<{ column: string; value: string }> {
  const filters: Array<{ column: string; value: string }> = []
  if (!dataset) {
    return filters
  }

  if (dataset.emailColumn && userEmail) {
    filters.push({ column: dataset.emailColumn, value: userEmail })
  }

  if (dataset.userIdColumn && user?.id) {
    filters.push({ column: dataset.userIdColumn, value: user.id })
  }

  return filters
}

function buildRealtimeFilter(
  filters: Array<{ column: string; value: string }>,
): string | undefined {
  if (!filters || filters.length === 0) {
    return undefined
  }

  const { column, value } = filters[0] ?? {}
  if (!column || typeof value === 'undefined' || value === null) {
    return undefined
  }

  return `${column}=eq.${value}`
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

  const normalized = trimmed.replace(/\//g, '-').replace(/\./g, '-')
  const dayMonthYearMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (dayMonthYearMatch) {
    const day = Number.parseInt(dayMonthYearMatch[1], 10)
    const month = Number.parseInt(dayMonthYearMatch[2], 10) - 1
    const rawYear = Number.parseInt(dayMonthYearMatch[3], 10)
    const year = dayMonthYearMatch[3].length === 2 ? 2000 + rawYear : rawYear
    const date = new Date(year, month, day)
    if (!Number.isNaN(date.getTime())) {
      return date.getTime()
    }
  }

  const yearMonthDayMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (yearMonthDayMatch) {
    const year = Number.parseInt(yearMonthDayMatch[1], 10)
    const month = Number.parseInt(yearMonthDayMatch[2], 10) - 1
    const day = Number.parseInt(yearMonthDayMatch[3], 10)
    const date = new Date(year, month, day)
    if (!Number.isNaN(date.getTime())) {
      return date.getTime()
    }
  }

  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return parsed
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

function mapRowToLabelRecord(row: Record<string, unknown>): LabelRecord {
  const getValue = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      if (!key) continue
      const value = row[key]
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed.length > 0) {
          return trimmed
        }
      }
      if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value)
      }
    }
    return undefined
  }

  const idCandidates = [
    getValue('id'),
    getValue('uuid'),
    getValue('record_id'),
    getValue('label_id'),
  ]
  let id = idCandidates.find((value) => typeof value === 'string' && value.length > 0)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
  }

  const fileName =
    getValue('file_name', 'filename', 'nombre_archivo', 'fileName', 'archivo') ??
    'Documento sin nombre.pdf'
  const status = getValue('status', 'estado')
  const destination = getValue('destination', 'destino', 'warehouse', 'almacen')
  const labelCode = getValue('label_code', 'codigo_etiqueta', 'label', 'code')
  const createdAt = getValue('created_at', 'createdAt', 'created', 'inserted_at')
  const updatedAt = getValue('updated_at', 'updatedAt', 'updated', 'modificado_en')
  const pdfUrl = getValue('pdf_url', 'pdfUrl', 'archivo_url', 'file_url')
  const labelUrl = getValue('label_url', 'labelUrl', 'etiqueta_url', 'output_url')
  const notes = getValue('notes', 'nota', 'comentarios', 'observaciones')
  const storagePath = getValue('storage_path', 'storagePath', 'path')

  return {
    id,
    fileName,
    status,
    destination,
    labelCode,
    createdAt,
    updatedAt,
    pdfUrl,
    labelUrl,
    notes,
    storagePath,
    raw: row,
  }
}

function formatDateTime(value?: string): string {
  if (!value) return '—'
  const parsed = parseDateValue(value)
  if (parsed !== null) {
    const date = new Date(parsed)
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date)
  }

  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date)
  }

  return value
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
  const parsed = parseDateValue(value)
  if (parsed === null) {
    return value
  }

  const date = new Date(parsed)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
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
