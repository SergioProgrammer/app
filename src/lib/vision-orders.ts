import type { LabelType } from '@/lib/product-selection'

export interface VisionOrderItem {
  id: string
  productName: string
  quantityText: string
  quantity?: string
  cantidad?: number
  units?: number
  client: string
  labelType: LabelType
  include: boolean
}

export interface VisionOrderTable {
  headers: string[]
  rows: string[][]
}

export interface VisionOrderParseResult {
  client: string
  items: VisionOrderItem[]
  rawText: string
  notes?: string
  table?: VisionOrderTable | null
}

const CLIENT_LABEL_MAP: Record<string, LabelType> = {
  mercadona: 'mercadona',
  aldi: 'aldi',
  lidl: 'lidl',
  hiperdino: 'hiperdino',
  kanali: 'kanali',
}

export function deriveLabelTypeFromClient(rawClient?: string): LabelType {
  const normalized = (rawClient ?? '').trim().toLowerCase()
  const direct = CLIENT_LABEL_MAP[normalized]
  if (direct) return direct
  if (normalized.includes('aldi')) return 'aldi'
  if (normalized.includes('lidl')) return 'lidl'
  if (normalized.includes('hiper')) return 'hiperdino'
  if (normalized.includes('kanali')) return 'kanali'
  return 'mercadona'
}

export function sanitizeProductName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return 'Producto sin nombre'
  return trimmed
}

export function buildVisionOrderItemId(productName: string, index: number): string {
  const slug = productName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const base = slug || 'item'
  return `${base}-${index}`
}
