'use client'

import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import {
  AlertTriangle,
  BarChart,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Sprout,
  Tag,
  Trash2,
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
import {
  DEFAULT_LABEL_TYPE,
  DEFAULT_PRODUCT,
  LABEL_TYPE_OPTIONS,
  LABEL_TYPE_PRODUCTS,
  PRODUCT_SELECTION_STORAGE_KEY,
  type LabelType,
  type ProductSelection,
  getLabelTypeLabel,
  normalizeLabelType,
  parseStoredProductSelection,
} from '@/lib/product-selection'

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
  lotValue?: string | null
  createdAt?: string
  updatedAt?: string
  pdfUrl?: string
  labelUrl?: string
  notes?: string
  storagePath?: string
  raw?: Record<string, unknown>
}

interface LabelUploadMeta {
  lote?: string
  fechaEnvasado?: string
  fechaCarga?: string
  labelCode?: string
  codigoCoc?: string
  codigoR?: string
  weight?: string
  labelType?: LabelType
  productName?: string
  variety?: string
}

interface UploadedFileAutomationFields {
  fechaEnvasado?: string | null
  fechaCarga?: string | null
  lote?: string | null
  labelCode?: string | null
  codigoCoc?: string | null
  codigoR?: string | null
  weight?: string | null
  productName?: string | null
  variety?: string | null
  labelType?: string | null
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
  labelFilePath?: string | null
  labelWebViewLink?: string | null
  labelWebContentLink?: string | null
  raw?: unknown
}

interface UploadedFileRecord {
  id: string
  name: string
  path: string
  storageBucket?: string | null
  size?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  publicUrl?: string | null
  destination?: string | null
  notes?: string | null
  mimeType?: string | null
  automation?: UploadedFileAutomation | null
  generatedFromFileId?: string | null
  labelType?: LabelType | null
  lotValue?: string | null
}

interface LotSearchResult {
  lot: string
  file: UploadedFileRecord | null
  historyRecord: LabelRecord | null
  status: 'searching' | 'found' | 'not-found'
}

type LabelStatusTone = 'pending' | 'success' | 'error' | 'info'

type TurnosDownloadRange = 'day' | 'week' | 'month' | 'year'

const TURNOS_RECENT_LIMIT = 8
const DEFAULT_WEIGHT = '40gr'
const DEFAULT_VARIETY = 'RED JASPER'
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOT_PREFIX_LENGTH = 2
const LOT_INITIAL_PREFIX = 'NS'
const LOT_INITIAL_NUMBER = '86913'
const LOT_NUMBER_LENGTH = LOT_INITIAL_NUMBER.length
const LOT_SEQUENCE_STORAGE_KEY = 'labels:last-lot-sequence'
const LOT_SEQUENCE_DEFAULT = `${LOT_INITIAL_PREFIX}${LOT_INITIAL_NUMBER}`
const LOT_PATTERN = new RegExp(`^[A-Z]{${LOT_PREFIX_LENGTH}}\\d{${LOT_NUMBER_LENGTH}}$`)
const LEGACY_LOT_PATTERN = new RegExp(`^[A-Z]{${LOT_PREFIX_LENGTH}}\\d{${LOT_NUMBER_LENGTH + 1}}$`)
const LOT_MAX_NUMBER = Number('9'.repeat(LOT_NUMBER_LENGTH))
const ALDI_LOT_PATTERN = /^(\d{1,2})\/(\d{1,2})$/
const ALDI_TRACE_PREFIX = 'E'
const ALDI_TRACE_LENGTH = 5
const ALDI_TRACE_INITIAL = 35578
const ALDI_TRACE_STORAGE_KEY = 'labels:aldi-trace-sequence'
const MANUAL_ORDER_FILE_PREFIX = 'pedido-manual-'
const INITIAL_PRODUCT_NAME = LABEL_TYPE_PRODUCTS[DEFAULT_LABEL_TYPE][0] ?? DEFAULT_PRODUCT
const COMPANY_DEFAULT_CODIGO_COC = (process.env.NEXT_PUBLIC_COMPANY_COC ?? '4063061581198').toUpperCase()
const DEFAULT_BARCODE_VALUE = (process.env.NEXT_PUBLIC_DEFAULT_BARCODE ?? '8437018336005').trim()
const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ETIQUETAS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_ETIQUETAS_BUCKET ?? 'etiquetas_final'
const SUPABASE_LIDL_WEIGHT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_LIDL_WEIGHT_BUCKET ?? 'grande_final'
const SUPABASE_LIDL_DETAIL_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_LIDL_DETAIL_BUCKET ?? 'grande2_final'
const LABEL_TYPE_LOGOS: Partial<Record<LabelType, string>> = {
  mercadona: '/logos/mercadona.jpg',
  aldi: '/logos/aldi.png',
  lidl: '/logos/lidl.svg',
  hiperdino: '/logos/hiperdino.png',
  kanali: '/logos/kanali.png',
}
const PRODUCT_BARCODE_MAP: Record<string, string> = (() => {
  try {
    const raw = JSON.parse(process.env.NEXT_PUBLIC_PRODUCT_BARCODES ?? '{}') as Record<string, unknown>
    return Object.entries(raw).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof key !== 'string') return acc
      if (typeof value !== 'string') return acc
      const normalizedKey = key.trim().toLowerCase()
      const normalizedValue = value.trim()
      if (normalizedKey && normalizedValue) {
        acc[normalizedKey] = normalizedValue
      }
      return acc
    }, {})
  } catch {
    return {}
  }
})()

function generateLotValue(labelType: LabelType = DEFAULT_LABEL_TYPE, referenceDate?: string | null): string {
  if (labelType === 'aldi') {
    return buildAldiLot(referenceDate)
  }
  const lastUsed = getLastPersistedLot()
  return incrementLotSequence(lastUsed)
}

function normalizeLot(value: string): string | null {
  const aldiLot = normalizeAldiLot(value)
  if (aldiLot) return aldiLot
  return normalizeStandardLot(value)
}

function normalizeStandardLot(value: string): string | null {
  if (typeof value !== 'string') return null
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (LOT_PATTERN.test(compact)) {
    return compact
  }
  if (LEGACY_LOT_PATTERN.test(compact)) {
    const prefix = compact.slice(0, LOT_PREFIX_LENGTH)
    const digits = compact.slice(-LOT_NUMBER_LENGTH)
    return `${prefix}${digits}`
  }
  return null
}

function findLotInString(value?: string | null): string | null {
  if (!value) return null
  const normalized = normalizeLot(value)
  if (normalized) return normalized
  const upper = value.toUpperCase()
  const inlinePattern = new RegExp(`[A-Z]{${LOT_PREFIX_LENGTH}}\\d{${LOT_NUMBER_LENGTH}}`)
  const legacyInlinePattern = new RegExp(
    `[A-Z]{${LOT_PREFIX_LENGTH}}\\d{${LOT_NUMBER_LENGTH + 1}}`,
  )
  const aldiPattern = /\d{1,2}\/\d{1,2}/
  const match =
    upper.match(aldiPattern) ?? upper.match(inlinePattern) ?? upper.match(legacyInlinePattern)
  if (match && match[0]) {
    return normalizeLot(match[0]) ?? match[0]
  }
  return null
}

function getLastPersistedLot(): string {
  if (typeof window === 'undefined') {
    return LOT_SEQUENCE_DEFAULT
  }
  try {
    const stored = window.localStorage.getItem(LOT_SEQUENCE_STORAGE_KEY)
    const normalized = stored ? normalizeStandardLot(stored) : null
    return normalized ?? LOT_SEQUENCE_DEFAULT
  } catch {
    return LOT_SEQUENCE_DEFAULT
  }
}

function incrementLotSequence(value: string): string {
  const normalized = normalizeStandardLot(value) ?? LOT_SEQUENCE_DEFAULT
  let prefix = normalized.slice(0, LOT_PREFIX_LENGTH)
  let numberPart = Number.parseInt(normalized.slice(LOT_PREFIX_LENGTH), 10)
  if (!Number.isFinite(numberPart)) {
    numberPart = 0
  }
  numberPart += 1
  if (numberPart > LOT_MAX_NUMBER) {
    numberPart = 0
    prefix = incrementLotPrefix(prefix)
  }
  return `${prefix}${numberPart.toString().padStart(LOT_NUMBER_LENGTH, '0')}`
}

function incrementLotPrefix(prefix: string): string {
  const characters = prefix.padStart(LOT_PREFIX_LENGTH, LETTERS[0]).slice(-LOT_PREFIX_LENGTH).split('')
  const firstLetter = 'N'
  const secondLetter = characters[1] ?? 'A'
  const secondIndex = LETTERS.indexOf(secondLetter)
  if (secondIndex === -1 || secondIndex === LETTERS.length - 1) {
    return `${firstLetter}${LETTERS[0]}`
  }
  return `${firstLetter}${LETTERS[secondIndex + 1]}`
}

function persistLotSequence(value: string): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeStandardLot(value)
  if (!normalized || normalizeAldiLot(normalized)) return
  try {
    window.localStorage.setItem(LOT_SEQUENCE_STORAGE_KEY, normalized)
  } catch {
    // ignore storage failures silently
  }
}

function resolveLotForLabelType(value: string, labelType: LabelType, referenceDate?: string | null): string {
  if (labelType === 'aldi') {
    const normalizedAldi = normalizeAldiLot(value)
    if (normalizedAldi) return normalizedAldi
    return buildAldiLot(referenceDate)
  }
  const normalized = normalizeStandardLot(value)
  if (normalized) return normalized
  return generateLotValue(labelType, referenceDate)
}

function buildAldiLot(referenceDate?: string | null): string {
  const parsed = referenceDate ? parseIsoDate(referenceDate) : null
  const date = parsed ?? new Date()
  const normalized = new Date(date.getTime())
  normalized.setHours(0, 0, 0, 0)
  const dayOfWeek = normalized.getDay() === 0 ? 7 : normalized.getDay()
  normalized.setDate(normalized.getDate() + (4 - dayOfWeek))
  const yearStart = new Date(normalized.getFullYear(), 0, 1)
  const diff = normalized.getTime() - yearStart.getTime()
  const week = Math.ceil((diff / 86_400_000 + 1) / 7)
  const weekText = String(Math.max(1, Math.min(53, week))).padStart(2, '0')
  const dayText = String(date.getDate()).padStart(2, '0')
  return `${weekText}/${dayText}`
}

function normalizeAldiLot(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const match = trimmed.match(ALDI_LOT_PATTERN)
  if (!match) return null
  const [, rawWeek, rawDay] = match
  const week = rawWeek.padStart(2, '0')
  const day = rawDay.padStart(2, '0')
  return `${week}/${day}`
}

function normalizeAldiTrace(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return null
  const trimmed = digits.slice(-ALDI_TRACE_LENGTH).padStart(ALDI_TRACE_LENGTH, '0')
  return `${ALDI_TRACE_PREFIX}${trimmed}`
}

function getLastAldiTrace(): string {
  if (typeof window === 'undefined') {
    return `${ALDI_TRACE_PREFIX}${String(ALDI_TRACE_INITIAL).padStart(ALDI_TRACE_LENGTH, '0')}`
  }
  try {
    const stored = window.localStorage.getItem(ALDI_TRACE_STORAGE_KEY)
    const normalized = normalizeAldiTrace(stored)
    if (normalized) return normalized
  } catch {
    // ignore storage issues
  }
  return `${ALDI_TRACE_PREFIX}${String(ALDI_TRACE_INITIAL).padStart(ALDI_TRACE_LENGTH, '0')}`
}

function incrementAldiTrace(value: string): string {
  const normalized = normalizeAldiTrace(value) ?? getLastAldiTrace()
  const digits = normalized.replace(/\D/g, '')
  const next = (Number.parseInt(digits, 10) || 0) + 1
  const wrapped = next % 100_000
  return `${ALDI_TRACE_PREFIX}${String(wrapped).padStart(ALDI_TRACE_LENGTH, '0')}`
}

function persistAldiTrace(value: string): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeAldiTrace(value)
  if (!normalized) return
  try {
    window.localStorage.setItem(ALDI_TRACE_STORAGE_KEY, normalized)
  } catch {
    // ignore storage failures
  }
}

function buildCodigoRForLabelType(labelType: LabelType, referenceDate?: string | null): string {
  if (labelType === 'aldi') {
    return getLastAldiTrace()
  }
  return buildCodigoRFromDate(referenceDate ?? getTodayIsoDate())
}

function resolveCodigoRForLabelType(
  labelType: LabelType,
  value?: string | null,
  referenceDate?: string | null,
): string | null {
  if (labelType === 'aldi') {
    const normalized = normalizeAldiTrace(value)
    return normalized ?? getLastAldiTrace()
  }
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length > 0) {
    return trimmed
  }
  const fallback = buildCodigoRFromDate(referenceDate ?? getTodayIsoDate())
  return fallback.length > 0 ? fallback : null
}

function getDefaultLabelCodeForProduct(productName?: string | null): string {
  if (!productName) return ''
  const normalized = productName.trim().toLowerCase()
  if (!normalized) return ''
  return PRODUCT_BARCODE_MAP[normalized] ?? DEFAULT_BARCODE_VALUE
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function buildCodigoRFromDate(value?: string | null): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return ''
  const offset = parsed.getUTCDay() === 6 ? 5 : 4
  const deliveryDate = addDaysUtc(parsed, offset)
  const day = deliveryDate.getUTCDate()
  return `R-${day}`
}

function getTodayIsoDate(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

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
  const searchParams = useSearchParams()
  const lotQueryParamRaw = searchParams?.get('lote') ?? ''
  const normalizedLotQuery = useMemo(() => {
    const trimmed = lotQueryParamRaw.trim()
    if (!trimmed) return ''
    return normalizeLot(trimmed) ?? trimmed.toUpperCase()
  }, [lotQueryParamRaw])
  const lotSearchResult = useMemo<LotSearchResult | null>(() => {
    if (!normalizedLotQuery) return null
    if (uploadedFilesLoading || labelsLoading) {
      return { lot: normalizedLotQuery, file: null, historyRecord: null, status: 'searching' }
    }
    const historyMatch =
      labelsData.find((record) => getLotFromLabelRecord(record) === normalizedLotQuery) ?? null
    const uploadMatch =
      uploadedFiles.find((file) => getLotFromUploadedFile(file) === normalizedLotQuery) ?? null
    if (historyMatch) {
      return {
        lot: normalizedLotQuery,
        file: uploadMatch ?? null,
        historyRecord: historyMatch,
        status: 'found',
      }
    }
    if (uploadMatch) {
      return { lot: normalizedLotQuery, file: uploadMatch, historyRecord: null, status: 'found' }
    }
    return {
      lot: normalizedLotQuery,
      file: uploadMatch ?? null,
      historyRecord: historyMatch,
      status: 'not-found',
    }
  }, [labelsData, labelsLoading, normalizedLotQuery, uploadedFiles, uploadedFilesLoading])
  const highlightedUploadId =
    lotSearchResult?.status === 'found' && lotSearchResult.file ? lotSearchResult.file.id : null
  const highlightedHistoryId =
    lotSearchResult?.status === 'found' && lotSearchResult.historyRecord
      ? lotSearchResult.historyRecord.id
      : null
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
  const baseFontSizeClass = 'text-[16px] sm:text-[17px]'
  const rootContainerClass = isLabelsPanel
    ? `min-h-screen bg-[#FAF9F6] flex flex-col ${baseFontSizeClass}`
    : `min-h-screen bg-[#FAF9F6] ${baseFontSizeClass}`
  const headerInnerClass = isLabelsPanel
    ? 'w-full px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between'
    : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between'
  const mainWrapperClass = isLabelsPanel
    ? 'w-full px-4 sm:px-6 lg:px-10 py-6'
    : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6'

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

const nonLabelPlans = useMemo(
  () => activePlans.filter((plan) => plan.dataset?.type !== 'labels'),
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
            const storageBucket =
              typeof (file as { bucket?: unknown }).bucket === 'string'
                ? ((file as { bucket?: string }).bucket ?? null)
                : null

            let destination: string | null = null
            let notes: string | null = null
            let automation: UploadedFileAutomation | null = null
            let generatedFromFileId: string | null = null
            let manualLabelType: LabelType | null = null
            let manualLot: string | null = null
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
                  if (parsed.manualFields && typeof parsed.manualFields === 'object') {
                    const manualPayload = parsed.manualFields as Record<string, unknown>
                    const labelTypeValue = manualPayload.labelType
                    if (typeof labelTypeValue === 'string') {
                      manualLabelType = normalizeLabelType(labelTypeValue)
                    }
                    const lotValue = manualPayload.lote
                    if (typeof lotValue === 'string' && lotValue.trim().length > 0) {
                      manualLot =
                        normalizeLot(lotValue) ??
                        lotValue.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase()
                    }
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
                        labelFilePath:
                          typeof automationPayload.labelFilePath === 'string'
                            ? automationPayload.labelFilePath
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
                          fechaCarga:
                            typeof fieldsPayload.fechaCarga === 'string'
                              ? fieldsPayload.fechaCarga
                              : null,
                          lote:
                            typeof fieldsPayload.lote === 'string'
                              ? fieldsPayload.lote
                              : null,
                          labelCode:
                            typeof fieldsPayload.labelCode === 'string'
                              ? fieldsPayload.labelCode
                              : null,
                          codigoCoc:
                            typeof fieldsPayload.codigoCoc === 'string'
                              ? fieldsPayload.codigoCoc
                              : null,
                          codigoR:
                            typeof fieldsPayload.codigoR === 'string'
                              ? fieldsPayload.codigoR
                              : null,
                          weight:
                            typeof fieldsPayload.weight === 'string'
                              ? fieldsPayload.weight
                              : null,
                          productName:
                            typeof fieldsPayload.productName === 'string'
                              ? fieldsPayload.productName
                              : null,
                          variety:
                            typeof fieldsPayload.variety === 'string'
                              ? fieldsPayload.variety
                              : null,
                          labelType:
                            typeof fieldsPayload.labelType === 'string'
                              ? fieldsPayload.labelType
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
            if (!automation && publicUrl) {
              automation = {
                status: 'completed',
                processedAt: file.updatedAt ?? file.createdAt ?? new Date().toISOString(),
                fields: {},
                labelWebViewLink: publicUrl,
                labelWebContentLink: publicUrl,
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
              storageBucket,
              size,
              createdAt: file.createdAt ?? null,
              updatedAt: file.updatedAt ?? null,
              publicUrl,
              mimeType,
              generatedFromFileId,
              lotValue: manualLot,
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
            if (manualLabelType) {
              record.labelType = manualLabelType
            }
            if (automation) {
              record.automation = automation
            }
            if (!record.labelType) {
              const automationLabelType = automation?.fields?.labelType
              if (typeof automationLabelType === 'string' && automationLabelType.trim().length > 0) {
                record.labelType = normalizeLabelType(automationLabelType)
              }
            }
            if (
              !record.labelType &&
              storageBucket === SUPABASE_ETIQUETAS_BUCKET &&
              typeof name === 'string' &&
              name.toLowerCase().includes('pedido-manual') &&
              name.toLowerCase().includes('etiqueta')
            ) {
              record.labelType = 'lidl'
            }
            if (!record.lotValue) {
              const automationLot = automation?.fields?.lote
              if (typeof automationLot === 'string' && automationLot.trim().length > 0) {
                record.lotValue = automationLot.trim().toUpperCase()
              }
            }

            return record
          })
          .sort((a, b) => {
            const parse = (value?: string | null) => {
              if (!value) return 0
              const time = new Date(value).getTime()
              return Number.isNaN(time) ? 0 : time
            }
            const left = parse(a.updatedAt) || parse(a.createdAt)
            const right = parse(b.updatedAt) || parse(b.createdAt)
            return right - left
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
      const isManualOrderFile = file.name.startsWith(MANUAL_ORDER_FILE_PREFIX) && mimeType === 'text/plain'
      const isAllowed =
        isManualOrderFile ||
        allowedMimeTypes.has(mimeType) ||
        allowedExtensions.some((extension) => normalizedName.endsWith(extension))

      if (!isAllowed) {
        setLabelUploadError(
          'Solo se admiten imágenes (PNG, JPG, WebP, HEIC, GIF). Convierte el albarán a imagen antes de subirlo o continúa sin archivo.',
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
        if (meta?.lote) {
          formData.append('manualLote', meta.lote)
        }
        if (meta?.fechaEnvasado) {
          formData.append('manualFechaEnvasado', meta.fechaEnvasado)
          formData.append('manualFechaCarga', meta.fechaEnvasado)
        }
        if (meta?.labelCode) {
          formData.append('manualLabelCode', meta.labelCode)
        }
        if (meta?.codigoCoc) {
          formData.append('manualCodigoCoc', meta.codigoCoc)
        }
        if (meta?.codigoR) {
          formData.append('manualCodigoR', meta.codigoR)
        }
        if (meta?.weight) {
          formData.append('manualWeight', meta.weight)
        }
        if (meta?.labelType) {
          formData.append('labelType', meta.labelType)
        }
        if (meta?.productName) {
          formData.append('productName', meta.productName)
        }
        if (meta?.variety) {
          formData.append('variety', meta.variety)
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
                  fechaCarga?: string | null
                  lote?: string | null
                  labelCode?: string | null
                  codigoCoc?: string | null
                  codigoR?: string | null
                  weight?: string | null
                }
                labelFileName?: string | null
                labelFilePath?: string | null
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
        const automationLabelName =
          typeof body.automation?.labelFileName === 'string' &&
          body.automation.labelFileName.trim().length > 0
            ? body.automation.labelFileName.trim()
            : null

        if (automationError) {
          setLabelUploadMessage(
            `Archivo "${fileName}" subido, pero la automatización falló: ${automationError}`,
          )
        } else {
          const successLabelName =
            automationLabelName && automationLabelName.length > 0
              ? automationLabelName
              : fileName
          setLabelUploadMessage(`ETIQUETA GENERADA CON ÉXITO - "${successLabelName}"`)
        }
        setUploadedFilesMessage(null)
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
          body: JSON.stringify({ fileId: file.id, bucket: file.storageBucket }),
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
    <div className={rootContainerClass}>
      {/* Topbar */}
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/50 bg-white/70 border-b">
        <div className={headerInnerClass}>
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

      <main className={mainWrapperClass}>
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

        {labelsPlan && (
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
            lotSearchResult={lotSearchResult}
            highlightedUploadId={highlightedUploadId}
            highlightedHistoryId={highlightedHistoryId}
            onReloadUploads={() => loadUploadedFiles()}
            onDeleteUpload={handleDeleteUploadedFile}
          />
        )}

        {nonLabelPlans.length > 0 && (
          <section className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-sm">
            <div className="space-y-6">
              {nonLabelPlans.map((plan) => (
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
                            <div key={`${plan.id}-${resource.label}`} className="flex items-center gap-2">
                              <select
                                value={turnosDownloadRange}
                                onChange={(event) =>
                                  setTurnosDownloadRange(event.target.value as TurnosDownloadRange)
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
                                {turnosDownloadLoading ? 'Generando…' : `Descargar ${resource.label}`}
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
  lotSearchResult,
  highlightedUploadId,
  highlightedHistoryId,
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
  lotSearchResult: LotSearchResult | null
  highlightedUploadId: string | null
  highlightedHistoryId: string | null
  onReloadUploads: () => void | Promise<void>
  onDeleteUpload: (file: UploadedFileRecord) => void | Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [deletingAllUploads, setDeletingAllUploads] = useState(false)
  const [manualLote, setManualLote] = useState(() => generateLotValue(DEFAULT_LABEL_TYPE))
  const [manualFechaCarga, setManualFechaCarga] = useState(() => getTodayIsoDate())
  const [manualCodigoR, setManualCodigoR] = useState('')
  const [manualWeight, setManualWeight] = useState(DEFAULT_WEIGHT)
  const [weightManuallyEdited, setWeightManuallyEdited] = useState(false)
  const [manualVariety, setManualVariety] = useState(DEFAULT_VARIETY)
  const [codigoRManuallyEdited, setCodigoRManuallyEdited] = useState(false)
  const [labelType, setLabelType] = useState<LabelType>(DEFAULT_LABEL_TYPE)
  const [productName, setProductName] = useState('')
  const [manualCodigoCoc, setManualCodigoCoc] = useState(() => COMPANY_DEFAULT_CODIGO_COC)
  const [codigoCocManuallyEdited, setCodigoCocManuallyEdited] = useState(false)
  const [manualLabelCode, setManualLabelCode] = useState(() =>
    getDefaultLabelCodeForProduct(INITIAL_PRODUCT_NAME),
  )
  const [labelCodeManuallyEdited, setLabelCodeManuallyEdited] = useState(false)
  const [activeStep, setActiveStep] = useState(1)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasResetAfterSuccessRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem('labels:manual-fields')
      if (!stored) return
      const parsed = JSON.parse(stored) as Partial<LabelUploadMeta>
      if (typeof parsed?.lote === 'string') {
        const normalized = normalizeLot(parsed.lote)
        if (normalized) {
          setManualLote(normalized)
        }
      }
      if (typeof parsed?.fechaCarga === 'string') {
        setManualFechaCarga(parsed.fechaCarga)
      } else if (typeof parsed?.fechaEnvasado === 'string') {
        setManualFechaCarga(parsed.fechaEnvasado)
      } else {
        setManualFechaCarga(getTodayIsoDate())
      }
      if (typeof parsed?.codigoR === 'string' && parsed.codigoR.trim().length > 0) {
        setManualCodigoR(parsed.codigoR)
        setCodigoRManuallyEdited(true)
      }
      if (typeof parsed?.codigoCoc === 'string' && parsed.codigoCoc.trim().length > 0) {
        setManualCodigoCoc(parsed.codigoCoc.toUpperCase())
        setCodigoCocManuallyEdited(true)
      } else if (COMPANY_DEFAULT_CODIGO_COC) {
        setManualCodigoCoc(COMPANY_DEFAULT_CODIGO_COC)
      }
      if (typeof parsed?.labelCode === 'string' && parsed.labelCode.trim().length > 0) {
        setManualLabelCode(parsed.labelCode.trim())
        setLabelCodeManuallyEdited(true)
      } else {
        const fallbackLabelCode = getDefaultLabelCodeForProduct(INITIAL_PRODUCT_NAME)
        if (fallbackLabelCode) {
          setManualLabelCode(fallbackLabelCode)
        }
      }
      if (typeof parsed?.weight === 'string' && parsed.weight.trim().length > 0) {
        setManualWeight(parsed.weight)
      }
      if (typeof parsed?.variety === 'string' && parsed.variety.trim().length > 0) {
        setManualVariety(parsed.variety)
      }
    } catch {
      // ignore malformed storage values
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const applyStoredSelection = (rawValue: string | null) => {
      const stored = parseStoredProductSelection(rawValue)
      if (stored) {
        const nextLabelType = stored.labelType
        setLabelType(nextLabelType)
        const isMercadona = nextLabelType === 'mercadona'
        setProductName(isMercadona ? LABEL_TYPE_PRODUCTS[nextLabelType][0] ?? DEFAULT_PRODUCT : '')
      }
    }

    applyStoredSelection(window.localStorage.getItem(PRODUCT_SELECTION_STORAGE_KEY))

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PRODUCT_SELECTION_STORAGE_KEY) return
      applyStoredSelection(event.newValue)
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    const allowFreeText = labelType === 'blanca-grande' || labelType === 'blanca-pequena'
    setProductName((current) => {
      const options = LABEL_TYPE_PRODUCTS[labelType]
      if (allowFreeText) {
        return current
      }
      if (labelType === 'mercadona') {
        return options[0] ?? DEFAULT_PRODUCT
      }
      return ''
    })
  }, [labelType])

  useEffect(() => {
    setWeightManuallyEdited(false)
  }, [labelType, productName])

  useEffect(() => {
    if (labelType !== 'aldi') return
    const desiredLot = resolveLotForLabelType(manualLote, labelType, manualFechaCarga)
    if (desiredLot !== manualLote) {
      setManualLote(desiredLot)
    }
    if (!codigoRManuallyEdited) {
      const nextTrace = resolveCodigoRForLabelType(labelType, manualCodigoR, manualFechaCarga)
      if (nextTrace && nextTrace !== manualCodigoR) {
        setManualCodigoR(nextTrace)
      }
    }
  }, [codigoRManuallyEdited, labelType, manualCodigoR, manualFechaCarga, manualLote])

  useEffect(() => {
    if (weightManuallyEdited) {
      return
    }
    const normalized = productName.trim().toLowerCase()
    const isLidl = labelType === 'lidl'
    const isAldi = labelType === 'aldi'
    let desiredWeight = DEFAULT_WEIGHT
    if (normalized === 'albahaca') {
      desiredWeight = '60gr'
    } else if (isLidl && normalized === 'eneldo') {
      desiredWeight = '30g'
    } else if (isAldi && normalized === 'eneldo') {
      desiredWeight = '30gr'
    }
    if (manualWeight !== desiredWeight) {
      setManualWeight(desiredWeight)
    }
  }, [labelType, manualWeight, productName, weightManuallyEdited])

  useEffect(() => {
    if (labelCodeManuallyEdited) return
    const fallback = getDefaultLabelCodeForProduct(productName)
    if (fallback) {
      setManualLabelCode(fallback)
    }
  }, [labelCodeManuallyEdited, productName])

  useEffect(() => {
    if (codigoCocManuallyEdited) return
    if (COMPANY_DEFAULT_CODIGO_COC) {
      setManualCodigoCoc(COMPANY_DEFAULT_CODIGO_COC)
    }
  }, [codigoCocManuallyEdited])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload: ProductSelection = {
      labelType,
      productName,
      savedAt: new Date().toISOString(),
    }
    try {
      window.localStorage.setItem(PRODUCT_SELECTION_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore storage errors
    }
  }, [labelType, productName])

  const derivedCodigoR = useMemo(
    () => buildCodigoRForLabelType(labelType, manualFechaCarga || getTodayIsoDate()),
    [labelType, manualFechaCarga],
  )
  const derivedLabelCode = useMemo(
    () => getDefaultLabelCodeForProduct(productName),
    [productName],
  )
  const derivedCodigoCoc = COMPANY_DEFAULT_CODIGO_COC

  useEffect(() => {
    if (!codigoRManuallyEdited) {
      setManualCodigoR(derivedCodigoR)
    }
  }, [codigoRManuallyEdited, derivedCodigoR])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload: LabelUploadMeta = {
      lote: manualLote,
      fechaEnvasado: manualFechaCarga,
      fechaCarga: manualFechaCarga,
      codigoR: manualCodigoR,
      codigoCoc: manualCodigoCoc,
      labelCode: manualLabelCode,
      weight: manualWeight,
      variety: manualVariety,
    }
    try {
      window.localStorage.setItem('labels:manual-fields', JSON.stringify(payload))
    } catch {
      // ignore storage quota issues
    }
  }, [
    manualCodigoCoc,
    manualCodigoR,
    manualFechaCarga,
    manualLabelCode,
    manualLote,
    manualWeight,
    manualVariety,
  ])

  const stepsInfo = useMemo(
    () => [
      { id: 1, title: 'Subir pedido', completed: true },
      { id: 2, title: 'Producto', completed: productName.trim().length > 0 },
    ],
    [productName],
  )

  const summaryStep = stepsInfo.length + 1
  const allStepsCompleted = stepsInfo.every((step) => step.completed)
  const canSubmit =
    manualLote.trim().length > 0 &&
    manualFechaCarga.trim().length > 0 &&
    manualCodigoCoc.trim().length > 0 &&
    manualLabelCode.trim().length > 0 &&
    manualWeight.trim().length > 0 &&
    productName.trim().length > 0

  const stepButtonBaseClass =
    'flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition'

  const resetForm = useCallback(() => {
    const today = getTodayIsoDate()
    const nextLot = generateLotValue(labelType, today)
    setFile(null)
    setLocalError(null)
    setManualLote(nextLot)
    setManualFechaCarga(today)
    const defaultCodigoR = labelType === 'aldi' ? getLastAldiTrace() : ''
    setManualCodigoR(defaultCodigoR)
    setCodigoRManuallyEdited(false)
    setManualCodigoCoc(COMPANY_DEFAULT_CODIGO_COC)
    setCodigoCocManuallyEdited(false)
    const fallbackLabelCode = getDefaultLabelCodeForProduct(productName)
    setManualLabelCode(fallbackLabelCode)
    setLabelCodeManuallyEdited(false)
    setManualWeight(DEFAULT_WEIGHT)
    setWeightManuallyEdited(false)
    setManualVariety(DEFAULT_VARIETY)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [labelType, productName])

  useEffect(() => {
    if (successMessage && !uploading && !hasResetAfterSuccessRef.current) {
      hasResetAfterSuccessRef.current = true
      resetForm()
      setActiveStep(1)
    }
    if (!successMessage) {
      hasResetAfterSuccessRef.current = false
    }
  }, [resetForm, successMessage, uploading])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] ?? null
      setFile(nextFile)
      if (nextFile) {
        setLocalError(null)
        const generatedLot = generateLotValue(labelType, manualFechaCarga)
        setManualLote(generatedLot)
      }
    },
    [labelType, manualFechaCarga, setManualLote, setLocalError],
  )

  const handleFechaChange = useCallback(
    (value: string) => {
      setLocalError(null)
      setManualFechaCarga(value)
      setCodigoRManuallyEdited(false)
      if (labelType === 'aldi') {
        setManualLote(buildAldiLot(value))
      }
    },
    [labelType],
  )

  const handleCodigoRInputChange = useCallback((value: string) => {
    setLocalError(null)
    setCodigoRManuallyEdited(true)
    setManualCodigoR(value)
  }, [])

  const handleCodigoCocChange = useCallback((value: string) => {
    setLocalError(null)
    setCodigoCocManuallyEdited(true)
    setManualCodigoCoc(value.toUpperCase())
  }, [])

  const handleLabelCodeChange = useCallback((value: string) => {
    setLocalError(null)
    setLabelCodeManuallyEdited(true)
    setManualLabelCode(value)
  }, [])

  const handleLoteChange = useCallback((value: string) => {
    setLocalError(null)
    setManualLote(value.toUpperCase())
  }, [])

  const handleWeightChange = useCallback((value: string) => {
    setLocalError(null)
    setManualWeight(value)
    setWeightManuallyEdited(true)
  }, [])

  const handleVarietyChange = useCallback((value: string) => {
    setLocalError(null)
    setManualVariety(value)
  }, [])

  const buildManualUploadFile = useCallback(() => {
    const manualNotes = [
      'Pedido creado sin archivo adjunto.',
      `Tipo de etiqueta: ${getLabelTypeLabel(labelType)}`,
      `Producto: ${productName.trim() || 'Sin producto'}`,
      `Variedad: ${manualVariety.trim() || 'Sin variedad'}`,
      `Peso: ${manualWeight.trim() || DEFAULT_WEIGHT}`,
      `Fecha: ${manualFechaCarga.trim() || 'Sin fecha'}`,
      `Código de barras: ${manualLabelCode.trim() || 'Sin dato'}`,
      `Código COC: ${manualCodigoCoc.trim() || 'Sin dato'}`,
      `${labelType === 'mercadona' ? 'Código R' : 'Código E'}: ${manualCodigoR.trim() || 'Sin dato'}`,
      `Lote: ${manualLote.trim() || 'Sin lote'}`,
    ].join('\n')
    const normalizedLotForFile =
      normalizeLot(manualLote) ?? manualLote.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const fallbackLotId =
      normalizedLotForFile && normalizedLotForFile.length > 0
        ? normalizedLotForFile
        : Date.now().toString(36)
    return new File(
      [manualNotes],
      `${MANUAL_ORDER_FILE_PREFIX}${fallbackLotId}.txt`,
      {
        type: 'text/plain',
      },
    )
  }, [
    labelType,
    manualCodigoCoc,
    manualCodigoR,
    manualFechaCarga,
    manualLabelCode,
    manualLote,
    manualVariety,
    manualWeight,
    productName,
  ])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const uploadFile = file ?? buildManualUploadFile()
      setLocalError(null)

      const meta: LabelUploadMeta = {}

      const normalizedLot = resolveLotForLabelType(manualLote, labelType, manualFechaCarga)
      meta.lote = normalizedLot
      if (manualLote !== normalizedLot) {
        setManualLote(normalizedLot)
      }

      if (manualFechaCarga.trim().length > 0) {
        meta.fechaEnvasado = manualFechaCarga.trim()
        meta.fechaCarga = manualFechaCarga.trim()
      }
      if (manualCodigoCoc.trim().length > 0) {
        meta.codigoCoc = manualCodigoCoc.trim()
      }
      const normalizedCodigoR = resolveCodigoRForLabelType(labelType, manualCodigoR, manualFechaCarga)
      if (normalizedCodigoR) {
        meta.codigoR = normalizedCodigoR
        if (manualCodigoR !== normalizedCodigoR) {
          setManualCodigoR(normalizedCodigoR)
        }
      }
      if (manualLabelCode.trim().length > 0) {
        meta.labelCode = manualLabelCode.trim()
      }
      meta.weight = manualWeight.trim().length > 0 ? manualWeight.trim() : DEFAULT_WEIGHT
      meta.labelType = labelType
      meta.productName = productName.trim()
      if (manualVariety.trim().length > 0) {
        meta.variety = manualVariety.trim()
      }

      await onUpload(uploadFile, meta)
      if (labelType === 'aldi') {
        if (normalizedCodigoR) {
          const nextTrace = incrementAldiTrace(normalizedCodigoR)
          persistAldiTrace(nextTrace)
        }
      } else {
        persistLotSequence(normalizedLot)
      }
    },
    [
      file,
      labelType,
      manualCodigoCoc,
      manualCodigoR,
      manualLabelCode,
      manualFechaCarga,
      manualLote,
      manualVariety,
      manualWeight,
      productName,
      buildManualUploadFile,
      onUpload,
    ],
  )


  const validateStep = useCallback(
    (step: number): string | null => {
      switch (step) {
        case 1:
          return null
        case 2:
          return productName.trim().length > 0
            ? null
            : 'Selecciona el producto que vas a etiquetar antes de continuar.'
        default:
          return null
      }
    },
    [productName],
  )

  const handleContinue = useCallback(() => {
    if (uploading) return
    if (activeStep >= summaryStep) return
    const error = validateStep(activeStep)
    if (error) {
      setLocalError(error)
      return
    }
    setLocalError(null)
    setActiveStep((previous) => Math.min(previous + 1, summaryStep))
  }, [activeStep, summaryStep, uploading, validateStep])

  const handleBack = useCallback(() => {
    if (uploading) return
    setLocalError(null)
    setActiveStep((previous) => Math.max(1, previous - 1))
  }, [uploading])

  const goToStep = useCallback(
    (stepNumber: number) => {
      if (uploading) return
      if (stepNumber < 1 || stepNumber > summaryStep) return
      if (stepNumber === summaryStep && !allStepsCompleted) return
      if (stepNumber > 1) {
        const previousCompleted = stepsInfo
          .filter((step) => step.id < stepNumber)
          .every((step) => step.completed)
        if (!previousCompleted) return
      }
      setLocalError(null)
      setActiveStep(stepNumber)
    },
    [allStepsCompleted, stepsInfo, summaryStep, uploading],
  )

  useEffect(() => {
    if (activeStep > summaryStep) {
      setActiveStep(summaryStep)
    }
  }, [activeStep, summaryStep])

  const handleViewHistory = useCallback(() => {
    const targetId = historyDisabled ? 'archivos-subidos' : 'historial-etiquetas'
    if (typeof document === 'undefined') return
    const section = document.getElementById(targetId)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [historyDisabled])

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

  const handleDeleteAllUploads = useCallback(async () => {
    if (uploads.length === 0 || deletingAllUploads) return
    const confirmed = window.confirm(
      '¿Seguro que quieres eliminar todos los archivos listados? Esta acción no se puede deshacer.',
    )
    if (!confirmed) return
    setDeletingAllUploads(true)
    try {
      for (const file of uploads) {
        // sequential to avoid overwhelming backend
        
        await onDeleteUpload(file)
      }
      await onReloadUploads()
    } catch (error) {
      console.error('Error al eliminar todos los archivos:', error)
      window.alert('Ocurrió un error eliminando algunos archivos. Revisa el historial y vuelve a intentarlo.')
    } finally {
      setDeletingAllUploads(false)
    }
  }, [deletingAllUploads, onDeleteUpload, onReloadUploads, uploads])

  const handleReloadUploads = useCallback(() => {
    void onReloadUploads()
  }, [onReloadUploads])


  const renderActiveStep = () => {
    if (activeStep === summaryStep) {
      const normalizedProductName = productName.trim().toLowerCase()
      const isLidlLotOnly = labelType === 'lidl'
      const isLidlAlbahaca = isLidlLotOnly && normalizedProductName === 'albahaca'
      const isKanali = labelType === 'kanali'
      const resumenValueParts: string[] = []
      if (isKanali) {
        if (manualLote.trim().length > 0) {
          resumenValueParts.push(`Lote ${manualLote.trim()}`)
        }
        if (manualFechaCarga.trim().length > 0) {
          resumenValueParts.push(`Fecha ${formatDate(manualFechaCarga.trim())}`)
        }
        if (manualWeight.trim().length > 0) {
          resumenValueParts.push(`Peso ${manualWeight.trim()}`)
        }
      } else if (!isLidlLotOnly) {
        if (productName.trim().length > 0) {
          resumenValueParts.push(`${productName.trim()} · ${getLabelTypeLabel(labelType)}`)
        } else {
          resumenValueParts.push(getLabelTypeLabel(labelType))
        }
        if (manualVariety.trim().length > 0) {
          resumenValueParts.push(`Variedad ${manualVariety.trim()}`)
        }
        if (manualWeight.trim().length > 0) {
          resumenValueParts.push(manualWeight.trim())
        }
        if (manualFechaCarga.trim().length > 0) {
          resumenValueParts.push(`Fecha ${formatDate(manualFechaCarga.trim())}`)
        }
        if (manualCodigoCoc.trim().length > 0) {
          resumenValueParts.push(`COC ${manualCodigoCoc.trim()}`)
        }
        if (manualCodigoR.trim().length > 0) {
          resumenValueParts.push(manualCodigoR.trim())
        }
        if (manualLabelCode.trim().length > 0) {
          resumenValueParts.push(`EAN ${manualLabelCode.trim()}`)
        }
      }
      if (!isKanali && manualLote.trim().length > 0) {
        resumenValueParts.push(`Lote ${manualLote.trim()}`)
      }
      if (isLidlLotOnly) {
        if (manualWeight.trim().length > 0) {
          resumenValueParts.push(`Peso ${manualWeight.trim()}`)
        }
        if (isLidlAlbahaca && manualFechaCarga.trim().length > 0) {
          resumenValueParts.push(`Fecha ${formatDate(manualFechaCarga.trim())}`)
        }
      }
      const resumenValue =
        resumenValueParts.length > 0
          ? resumenValueParts.join(' · ')
          : 'Selecciona el producto en el paso anterior para completar este resumen.'

      const summaryStaticItems = [
        { label: 'Subir pedido', value: file ? file.name : 'Sin pedido adjunto' },
        ...(isLidlLotOnly
          ? []
          : [
              { label: 'Tipo de etiqueta', value: getLabelTypeLabel(labelType) },
              { label: 'Producto', value: productName.trim() || 'Sin producto seleccionado' },
              { label: 'Variedad', value: manualVariety.trim() || 'Sin variedad' },
            ]),
        { label: 'Resumen', value: resumenValue },
      ]
      if (labelType === 'lidl') {
        summaryStaticItems.push({
          label: 'Salida',
          value: '3 etiquetas: principal + 2 blancas (peso y detalle)',
        })
      }

      const summaryEditableFields: Array<{
        name: string
        label: string
        type: 'text' | 'date'
        value: string
        placeholder?: string
        helper?: string
        onChange: (value: string) => void
      }> = (() => {
        if (isLidlLotOnly) {
          const lidlWeightPlaceholder =
            normalizedProductName === 'eneldo'
              ? '30g'
              : normalizedProductName === 'albahaca'
              ? '60gr'
              : DEFAULT_WEIGHT
          const lidlWeightHelper =
            normalizedProductName === 'eneldo'
              ? 'Valor fijo por defecto 30g.'
              : normalizedProductName === 'albahaca'
              ? 'Valor por defecto 60gr.'
              : undefined
          const lidlFields: Array<{
            name: string
            label: string
            type: 'text' | 'date'
            value: string
            placeholder?: string
            helper?: string
            onChange: (value: string) => void
          }> = [
            {
              name: 'lote',
              label: 'Lote',
              type: 'text',
              value: manualLote,
              placeholder: LOT_SEQUENCE_DEFAULT,
              onChange: handleLoteChange,
            },
            {
              name: 'peso',
              label: 'Peso',
              type: 'text',
              value: manualWeight,
              placeholder: lidlWeightPlaceholder,
              helper: lidlWeightHelper,
              onChange: handleWeightChange,
            },
          ]
          if (isLidlAlbahaca) {
            lidlFields.push({
              name: 'fecha',
              label: 'Fecha envasado / carga',
              type: 'date',
              value: manualFechaCarga,
              helper: 'Verifica la fecha importada automáticamente.',
              onChange: handleFechaChange,
            })
          }
          return lidlFields
        }
        if (isKanali) {
          return [
            {
              name: 'lote',
              label: 'Lote',
              type: 'text',
              value: manualLote,
              placeholder: LOT_SEQUENCE_DEFAULT,
              onChange: handleLoteChange,
            },
            {
              name: 'fecha',
              label: 'Fecha envasado / carga',
              type: 'date',
              value: manualFechaCarga,
              helper: 'Verifica la fecha importada automáticamente.',
              onChange: handleFechaChange,
            },
            {
              name: 'peso',
              label: 'Peso',
              type: 'text',
              value: manualWeight,
              placeholder: 'Ej. 40gr',
              onChange: handleWeightChange,
            },
          ]
        }
        if (
          labelType === 'aldi' &&
          productName.trim().toLowerCase() === 'hojas frescas acelga'
        ) {
          return [
            {
              name: 'lote',
              label: 'Lote',
              type: 'text',
              value: manualLote,
              placeholder: '48/25',
              onChange: handleLoteChange,
            },
            {
              name: 'peso',
              label: 'Peso',
              type: 'text',
              value: manualWeight,
              placeholder: 'Ej. 40gr',
              onChange: handleWeightChange,
            },
            {
              name: 'codigoR',
              label: 'Código E',
              type: 'text',
              value: manualCodigoR,
              placeholder: derivedCodigoR || 'E35578',
              helper: 'Código de trazabilidad Aldi (E + 5 dígitos).',
              onChange: handleCodigoRInputChange,
            },
          ]
        }
        return [
          {
            name: 'variety',
            label: 'Variedad',
            type: 'text',
            value: manualVariety,
            placeholder: DEFAULT_VARIETY,
            helper: 'Texto que irá debajo del producto en las etiquetas blancas.',
            onChange: handleVarietyChange,
          },
          {
            name: 'fecha',
            label: 'Fecha envasado / carga',
            type: 'date',
            value: manualFechaCarga,
            helper: 'Marca la fecha que aparece en el pedido.',
            onChange: handleFechaChange,
          },
          {
            name: 'lote',
            label: 'Lote',
            type: 'text',
            value: manualLote,
            placeholder: labelType === 'aldi' ? '48/25' : LOT_SEQUENCE_DEFAULT,
            onChange: handleLoteChange,
          },
          {
            name: 'peso',
            label: 'Peso',
            type: 'text',
            value: manualWeight,
            placeholder: 'Ej. 40gr',
            onChange: handleWeightChange,
          },
          {
            name: 'codigoCoc',
            label: 'Código COC',
            type: 'text',
            value: manualCodigoCoc,
            placeholder: '4063061581198',
            helper: 'Código fijo proporcionado por la empresa.',
            onChange: handleCodigoCocChange,
          },
          {
            name: 'labelCode',
            label: 'Código de barras',
            type: 'text',
            value: manualLabelCode,
            placeholder: derivedLabelCode || '8437018336005',
            helper: 'Asignado al producto por la central.',
            onChange: handleLabelCodeChange,
          },
          {
            name: 'codigoR',
            label: labelType === 'mercadona' ? 'Código R' : 'Código E',
            type: 'text',
            value: manualCodigoR,
            placeholder:
              labelType === 'mercadona'
                ? derivedCodigoR || 'R-15'
                : derivedCodigoR || 'E35578',
            helper:
              labelType === 'aldi'
                ? 'Código de trazabilidad Aldi (E + 5 dígitos).'
                : 'Se genera automáticamente sumando 4 días (5 si la fecha cae en sábado).',
            onChange: handleCodigoRInputChange,
          },
        ]
      })()

      return (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-200 bg-[#FAF9F6] p-5 space-y-5"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900">{`Paso ${summaryStep}. Resumen`}</p>
            <p className="mt-1 text-sm text-gray-600">
              Confirma esta información antes de generar la etiqueta automática.
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {summaryStaticItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <dt className="text-xs uppercase tracking-wide text-gray-500">{item.label}</dt>
                <dd className="mt-1 text-sm text-gray-900 break-words">{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">Datos editables</p>
            <p className="mt-1 text-xs text-gray-600">
              Ajusta cualquier campo antes de generar la etiqueta. Guardamos tus últimos valores para el siguiente pedido.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {summaryEditableFields.map((field) => (
                <label key={field.name} className="text-sm font-medium text-gray-700">
                  {field.label}
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    disabled={uploading}
                  />
                  {field.helper && <span className="mt-1 block text-xs text-gray-500">{field.helper}</span>}
                  {field.name === 'codigoR' && derivedCodigoR && (
                    <button
                      type="button"
                      onClick={() => {
                        setCodigoRManuallyEdited(false)
                        setManualCodigoR(derivedCodigoR)
                      }}
                      className="mt-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                      disabled={uploading}
                    >
                      Usar valor sugerido ({derivedCodigoR})
                    </button>
                  )}
                  {field.name === 'codigoCoc' && derivedCodigoCoc && (
                    <button
                      type="button"
                      onClick={() => {
                        setCodigoCocManuallyEdited(false)
                        setManualCodigoCoc(derivedCodigoCoc)
                      }}
                      className="mt-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                      disabled={uploading}
                    >
                      Usar valor fijo ({derivedCodigoCoc})
                    </button>
                  )}
                  {field.name === 'labelCode' && derivedLabelCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setLabelCodeManuallyEdited(false)
                        setManualLabelCode(derivedLabelCode)
                      }}
                      className="mt-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                      disabled={uploading}
                    >
                      Usar código asignado ({derivedLabelCode})
                    </button>
                  )}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              disabled={uploading}
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={!canSubmit || uploading}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition ${
                !canSubmit || uploading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:opacity-90'
              }`}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando…
                </span>
              ) : (
                'Generar etiqueta'
              )}
            </button>
          </div>
        </form>
      )
    }

    switch (activeStep) {
      case 1:
        return (
          <div className="rounded-2xl border border-gray-200 bg-[#FAF9F6] p-5 space-y-5">
            
            <div>
              <p className="text-sm font-semibold text-gray-900">Tipo de etiqueta</p>
              
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(Object.keys(LABEL_TYPE_OPTIONS) as LabelType[]).map((optionKey) => {
                  const option = LABEL_TYPE_OPTIONS[optionKey]
                  const isActive = labelType === optionKey
                  const logo = LABEL_TYPE_LOGOS[optionKey]
                  return (
                    <button
                      key={optionKey}
                      type="button"
                      onClick={() => setLabelType(optionKey)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                      disabled={uploading}
                    >
                      <div className="flex items-center gap-3">
                        {logo && (
                          <span className="relative h-10 w-10 overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <Image
                              src={logo}
                              alt={option.label}
                              fill
                              className="object-contain p-1"
                              sizes="40px"
                            />
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className="mt-1 text-xs text-gray-500">{option.description}</p>
                          {option.helper && (
                            <p className="mt-2 text-xs font-medium text-emerald-700">{option.helper}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
              
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
                <button
                  type="button"
                  onClick={handleContinue}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                  disabled={uploading}
                >
                  Continuar
                </button>
              </div>
              {file ? (
                <p className="mt-2 text-xs text-gray-500">
                  Archivo seleccionado: <span className="font-medium text-gray-700">{file.name}</span>
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">Sin archivo adjunto (lo generaremos en automático).</p>
              )}
            </div>
          </div>
        )
      case 2: {
        const availableProducts = LABEL_TYPE_PRODUCTS[labelType]
        const isWhiteLabelType = labelType === 'blanca-grande' || labelType === 'blanca-pequena'
        return (
          <div className="rounded-2xl border border-gray-200 bg-[#FAF9F6] p-5">
            <p className="text-sm font-semibold text-gray-900">Producto</p>
            <p className="mt-1 text-sm text-gray-600">
              {isWhiteLabelType
                ? 'Escribe el texto exacto que debe aparecer como encabezado.'
                : labelType === 'mercadona'
                ? 'Para Mercadona solo trabajamos con Albahaca.'
                : 'Selecciona el producto que debe aparecer en la etiqueta.'}
            </p>
            {isWhiteLabelType ? (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  value={productName}
                  onChange={(event) => {
                    setLocalError(null)
                    setProductName(event.target.value)
                  }}
                  placeholder="Ej. Sandía Blanca 10x300gr"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  disabled={uploading}
                />
                <p className="text-xs text-gray-500">
                  Este texto se imprimirá tal cual en la primera línea de la etiqueta.
                </p>
              </div>
            ) : (
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
                      onClick={() => {
                        setLocalError(null)
                        setProductName(option)
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                      disabled={uploading}
                    >
                      <p className="text-sm font-semibold">{option}</p>
                      {labelType !== 'mercadona' && (
                        <p className="mt-1 text-xs text-gray-500">{`Disponible para ${getLabelTypeLabel(labelType).toLowerCase()}.`}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {labelType === 'mercadona' && !isWhiteLabelType && (
              <p className="mt-3 text-xs text-emerald-700">
                Mercadona utiliza etiqueta fija de Albahaca. No necesitas elegir nada más en este paso.
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                disabled={uploading}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                disabled={uploading}
              >
                Continuar
              </button>
            </div>
          </div>
        )
      }
      default:
        return null
    }
  }

  const renderLotSearchBanner = () => {
    if (!lotSearchResult) return null
    const { status, lot, file, historyRecord } = lotSearchResult
    const foundInHistory = status === 'found' && Boolean(historyRecord)
    const foundInUploads = status === 'found' && !historyRecord && Boolean(file)
    const baseClass =
      status === 'found'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : status === 'searching'
        ? 'border-gray-200 bg-gray-50 text-gray-700'
        : 'border-amber-200 bg-amber-50 text-amber-900'
    const historyLink = historyRecord?.labelUrl ?? historyRecord?.pdfUrl ?? null
    const uploadLink = file ? resolveAutomationLink(file) : null

    return (
      <div
        className={`mt-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${baseClass}`}
      >
        {status === 'searching' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Buscamos el lote {lot}…</span>
          </>
        ) : status === 'found' ? (
          <>
            <p className="font-semibold">
              {foundInHistory && historyRecord
                ? `Lote ${lot} encontrado en el historial (${historyRecord.fileName || 'registro'})`
                : foundInUploads && file
                ? `Lote ${lot} listo en ${file.name}`
                : `Lote ${lot} localizado`}
            </p>
            <div className="flex flex-wrap gap-2">
              {foundInHistory && historyLink && (
                <a
                  href={historyLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 transition hover:bg-gray-100"
                >
                  Ver etiqueta
                </a>
              )}
              {foundInUploads && uploadLink && (
                <a
                  href={uploadLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 transition hover:bg-gray-100"
                >
                  Etiqueta
                </a>
              )}
              {foundInUploads && !uploadLink && (
                <span className="text-xs text-gray-500">Sin enlace disponible</span>
              )}
            </div>
          </>
        ) : (
          <p className="font-semibold">No encontramos el lote {lot}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <section id="archivos-subidos" className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-xl font-semibold text-gray-900">Genera tu etiqueta</h4>
            <p className="text-sm text-gray-600">
              Sigue los pasos en orden y rellena solo los datos imprescindibles.
            </p>
          </div>
          <button
            type="button"
            onClick={handleViewHistory}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            disabled={uploading}
          >
            Etiquetas Generadas
          </button>
        </header>

        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            {stepsInfo.map((step) => {
              const isActive = activeStep === step.id
              const isCompleted = step.completed
              const accessible =
                step.id === 1 ||
                stepsInfo
                  .filter((candidate) => candidate.id < step.id)
                  .every((candidate) => candidate.completed)
              let stateClasses = ''
              if (isCompleted) {
                stateClasses = 'border-emerald-200 bg-emerald-50 text-emerald-700'
              } else if (isActive) {
                stateClasses = 'border-gray-900 bg-gray-50 text-gray-900'
              } else {
                stateClasses = 'border-gray-200 text-gray-500'
              }
              const disabled = !accessible || uploading
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  disabled={disabled}
                  className={`${stepButtonBaseClass} ${stateClasses} ${
                    disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#FAF9F6]'
                  }`}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">
                    {String(step.id).padStart(2, '0')}
                  </span>
                  <span className="text-sm">{step.title}</span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => goToStep(summaryStep)}
              disabled={!allStepsCompleted || uploading}
              className={`${stepButtonBaseClass} ${
                activeStep === summaryStep
                  ? 'border-gray-900 bg-gray-50 text-gray-900'
                  : allStepsCompleted
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-500'
              } ${!allStepsCompleted || uploading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#FAF9F6]'}`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">
                {String(summaryStep).padStart(2, '0')}
              </span>
              <span className="text-sm">Resumen</span>
            </button>
          </div>

          <div>{renderActiveStep()}</div>

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
        </div>
      </section>
      {historyDisabled ? (
        <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="text-lg font-semibold text-gray-900">Archivos subidos</h4>
              {uploadsFolder !== null && (
                <span className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
                  {uploadsFolder.length === 0 ? 'Carpeta principal' : uploadsFolder}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                onClick={handleDeleteAllUploads}
                disabled={uploadsLoading || deletingAllUploads || uploads.length === 0}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  uploadsLoading || deletingAllUploads || uploads.length === 0
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-red-200 text-red-700 hover:bg-red-50'
                }`}
              >
                {deletingAllUploads ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deletingAllUploads ? 'Eliminando…' : 'Eliminar todo'}
              </button>
            </div>
          </header>

          {renderLotSearchBanner()}

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
                Sube tu primer albarán para verlo listado aquí.
              </p>
            ) : (
              <ul className="space-y-3">
                {uploads.map((file) => {
                  const isDeleting = uploadsDeletingId === file.id
                  const automation = file.automation ?? null
                  const extractedFields = automation?.fields ?? null
                  const isHighlighted = highlightedUploadId === file.id
                  const uploadedAt = file.createdAt ?? file.updatedAt ?? null
                  const metaParts: string[] = []
                  if (file.size != null) metaParts.push(formatBytes(file.size))
                  if (uploadedAt) metaParts.push(formatDateTime(uploadedAt))
                  const metaLine = metaParts.join(' · ')
                  const automationStatusLabel =
                    automation?.status === 'completed'
                      ? 'Listo'
                      : automation?.status === 'error'
                      ? 'Revisar'
                      : null
                const automationStatusTone =
                  automation?.status === 'completed'
                    ? 'success'
                    : automation?.status === 'error'
                    ? 'error'
                    : 'info'
                const automationLink = resolveAutomationLink(file)
                const displayLabelName = getDisplayLabelName(file)
                const fileLabelType = (file.labelType ?? file.automation?.fields?.labelType ?? '').toLowerCase()
                const cajaUrls = deriveLidlCajaUrls(file)
                const isLidlLabel =
                  fileLabelType.includes('lidl') ||
                  cajaUrls.isLikelyLidl === true
                const secondaryParts: string[] = []
                if (file.destination) secondaryParts.push(`Destino ${file.destination}`)
                if (file.notes) secondaryParts.push(file.notes)
                if (file.generatedFromFileId) {
                  secondaryParts.push(`Origen ${formatShortId(file.generatedFromFileId)}`)
                  }
                  return (
                    <li
                      key={file.id}
                      className={`rounded-2xl border px-4 py-3 text-sm text-gray-700 transition ${
                        isHighlighted ? 'border-emerald-300 bg-emerald-50/70' : 'hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">{displayLabelName}</p>
                            {metaLine && <p className="text-xs text-gray-500">{metaLine}</p>}
                            {file.path && <p className="text-xs text-gray-400 truncate">{file.path}</p>}
                          </div>
                        </div>
                        <div className="ml-auto flex flex-wrap items-center gap-3">
                          {automationStatusLabel && (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                automationStatusTone === 'success'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : automationStatusTone === 'error'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {automationStatusLabel}
                            </span>
                          )}
                          {isHighlighted && (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              Coincide
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                            {automationLink ? (
                              <a
                                href={automationLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-1.5 text-gray-900 transition hover:bg-gray-100"
                              >
                                Ver etiqueta
                              </a>
                            ) : (
                              <span className="text-gray-400">Sin enlace</span>
                            )}
                            {isLidlLabel && (cajaUrls.caja1 || cajaUrls.caja2) && (
                              <>
                                {cajaUrls.caja1 && (
                                  <a
                                    href={cajaUrls.caja1}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-1.5 text-gray-900 transition hover:bg-gray-100"
                                  >
                                    Caja 1
                                  </a>
                                )}
                                {cajaUrls.caja2 && (
                                  <a
                                    href={cajaUrls.caja2}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-1.5 text-gray-900 transition hover:bg-gray-100"
                                  >
                                    Caja 2
                                  </a>
                                )}
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteUpload(file)}
                              disabled={isDeleting}
                              className={`inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-1.5 transition ${
                                isDeleting ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'text-gray-700 hover:bg-gray-100'
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
                        </div>
                      </div>
                      {(secondaryParts.length > 0 ||
                        extractedFields?.fechaEnvasado ||
                        extractedFields?.lote ||
                        extractedFields?.codigoCoc ||
                        extractedFields?.codigoR) && (
                        <div className="mt-2 space-y-1 text-xs text-gray-500">
                          {secondaryParts.length > 0 && <p>{secondaryParts.join(' · ')}</p>}
                          {(extractedFields?.fechaEnvasado ||
                            extractedFields?.lote ||
                            extractedFields?.codigoCoc ||
                            extractedFields?.codigoR) && (
                            <p className="flex flex-wrap gap-2">
                              {extractedFields?.fechaEnvasado && (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5">
                                  Envasado {extractedFields.fechaEnvasado}
                                </span>
                              )}
                              {extractedFields?.lote && (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5">Lote {extractedFields.lote}</span>
                              )}
                              {extractedFields?.codigoCoc && (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5">COC {extractedFields.codigoCoc}</span>
                              )}
                              {extractedFields?.codigoR && (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5">R {extractedFields.codigoR}</span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                      {automation?.error && (
                        <p className="mt-2 text-xs text-red-600">Error: {automation.error}</p>
                      )}
                      {automation?.notes && (
                        <p className="mt-1 text-xs italic text-gray-500">Notas: {automation.notes}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
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
            <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                onClick={handleDeleteAllUploads}
                disabled={loading || deletingAllUploads || uploads.length === 0}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  loading || deletingAllUploads || uploads.length === 0
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-red-200 text-red-700 hover:bg-red-50'
                }`}
              >
                {deletingAllUploads ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deletingAllUploads ? 'Eliminando…' : 'Eliminar todo'}
              </button>
            </div>
          </header>

          {renderLotSearchBanner()}

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
                      const isHighlighted = highlightedHistoryId === record.id
                      return (
                        <tr
                          key={record.id}
                          className={`transition ${isHighlighted ? 'bg-emerald-50/70' : 'hover:bg-[#FAF9F6]'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-900 truncate max-w-[220px]">
                                  {record.fileName || 'Archivo sin nombre'}
                                </p>
                                {isHighlighted && (
                                  <p className="mt-0.5 inline-flex items-center rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                    Coincide con la búsqueda
                                  </p>
                                )}
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
    getValue('file_name', 'filename','archivo') ??
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
  const lotValue =
    findLotInString(
      getValue('lote', 'lot', 'lote_code', 'lote_numero', 'lot_number', 'lote_id', 'lote_pedido'),
    ) ??
    findLotInString(fileName) ??
    findLotInString(storagePath) ??
    findLotInString(labelUrl) ??
    findLotInString(notes)

  return {
    id,
    fileName,
    status,
    destination,
    labelCode,
    lotValue: lotValue ?? null,
    createdAt,
    updatedAt,
    pdfUrl,
    labelUrl,
    notes,
    storagePath,
    raw: row,
  }
}

function getLotFromLabelRecord(record: LabelRecord | null | undefined): string | null {
  if (!record) return null
  const sources = [
    record.lotValue,
    record.fileName,
    record.storagePath,
    record.labelUrl,
    record.pdfUrl,
    record.notes,
  ]
  for (const source of sources) {
    const lot = findLotInString(source)
    if (lot) return lot
  }
  return null
}

function getLotFromUploadedFile(file: UploadedFileRecord | null | undefined): string | null {
  if (!file) return null
  const sources = [
    file.lotValue,
    file.automation?.fields?.lote,
    file.name,
    file.path,
    file.automation?.labelFileName,
  ]
  for (const source of sources) {
    const lot = findLotInString(source)
    if (lot) return lot
  }
  return null
}

function resolveAutomationLink(file: UploadedFileRecord): string | null {
  if (!file) return null
  const directLink = file.automation?.labelWebViewLink ?? file.automation?.labelWebContentLink
  if (directLink) {
    return directLink
  }
  if (!SUPABASE_PUBLIC_URL) {
    return null
  }
  const labelPath = buildLabelStoragePath(file)
  if (!labelPath) {
    return null
  }
  return buildPublicLabelUrl(labelPath)
}

function deriveLidlCajaUrls(
  file: UploadedFileRecord,
): { caja1?: string; caja2?: string; isLikelyLidl?: boolean } {
  const labelPath = buildLabelStoragePath(file)
  if (!labelPath) return {}
  const lastSlash = labelPath.lastIndexOf('/')
  const folder = lastSlash >= 0 ? labelPath.slice(0, lastSlash) : ''
  const fileName = lastSlash >= 0 ? labelPath.slice(lastSlash + 1) : labelPath
  const baseSeed = fileName.replace(/\.pdf$/i, '').replace(/-etiqueta$/i, '')
  if (!baseSeed) return {}
  const caja1Path = folder ? `${folder}/${baseSeed}-caja-etiqueta.pdf` : `${baseSeed}-caja-etiqueta.pdf`
  const caja2Path = folder ? `${folder}/${baseSeed}-caja2-etiqueta.pdf` : `${baseSeed}-caja2-etiqueta.pdf`
  const caja1 = buildPublicLabelUrlWithBucket(caja1Path, SUPABASE_LIDL_WEIGHT_BUCKET)
  const caja2 = buildPublicLabelUrlWithBucket(caja2Path, SUPABASE_LIDL_DETAIL_BUCKET)
  const isLikelyLidl = /^pedido-manual-[a-z0-9-]+$/i.test(baseSeed)
  return { caja1: caja1 ?? undefined, caja2: caja2 ?? undefined, isLikelyLidl }
}

function buildLabelStoragePath(file: UploadedFileRecord): string | null {
  if (!file) return null
  if (file.storageBucket && file.storageBucket === SUPABASE_ETIQUETAS_BUCKET) {
    const path = file.path || file.name
    return typeof path === 'string' && path.length > 0 ? path : null
  }
  const automationFilePath = file.automation?.labelFilePath ?? null
  if (automationFilePath) {
    return automationFilePath
  }
  const automationFileName = file.automation?.labelFileName ?? null
  const folder =
    file.path && file.path.includes('/')
      ? file.path.slice(0, file.path.lastIndexOf('/'))
      : ''
  if (automationFileName) {
    return folder ? `${folder}/${automationFileName}` : automationFileName
  }
  const lotFromAutomation = file.lotValue ?? file.automation?.fields?.lote ?? null
  const sanitizedLot =
    typeof lotFromAutomation === 'string' && lotFromAutomation.trim().length > 0
      ? lotFromAutomation.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      : null
  if (sanitizedLot) {
    const labelFileName = `etiqueta-${sanitizedLot}.pdf`
    return folder ? `${folder}/${labelFileName}` : labelFileName
  }
  if (!file.name) return null
  const baseName = file.name.replace(/\.[^.]+$/, '')
  if (!baseName) return null
  const fallbackLabelFileName = `${baseName}-etiqueta.pdf`
  return folder ? `${folder}/${fallbackLabelFileName}` : fallbackLabelFileName
}

function buildPublicLabelUrl(path: string | null | undefined): string | null {
  return buildPublicLabelUrlWithBucket(path, SUPABASE_ETIQUETAS_BUCKET)
}

function buildPublicLabelUrlWithBucket(
  path: string | null | undefined,
  bucket: string | null | undefined,
): string | null {
  if (!path) return null
  if (!SUPABASE_PUBLIC_URL) return null
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const targetBucket = encodeURIComponent(bucket ?? SUPABASE_ETIQUETAS_BUCKET)
  return `${SUPABASE_PUBLIC_URL}/storage/v1/object/public/${targetBucket}/${encodedPath}`
}

function getDisplayLabelName(file: UploadedFileRecord): string {
  const automationName = file.automation?.labelFileName
  if (automationName && automationName.trim().length > 0) {
    return automationName.trim()
  }
  if (file.lotValue && file.lotValue.trim().length > 0) {
    return `etiqueta-${file.lotValue.trim()}.pdf`
  }
  return file.name
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
