import { getSupabaseServiceClient } from './supabase-storage'

export interface InventoryRecord {
  id: string
  product_name: string
  units_available: number
  created_at?: string | null
  updated_at?: string | null
}

const INVENTORY_TABLE = process.env.SUPABASE_INVENTORY_TABLE ?? 'inventory'
const DEFAULT_INITIAL_UNITS = 1000

function sanitizeProductName(name: string): string {
  return name?.trim() ?? ''
}

async function fetchInventoryRecord(productName: string): Promise<InventoryRecord | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from(INVENTORY_TABLE)
    .select('*')
    .eq('product_name', productName)
    .maybeSingle()

  if (error) {
    console.error('[inventory] fetch error', error)
    return null
  }
  return (data as InventoryRecord | null) ?? null
}

async function insertInventoryRecord(
  productName: string,
  units: number,
): Promise<InventoryRecord | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from(INVENTORY_TABLE)
    .insert({ product_name: productName, units_available: units })
    .select('*')
    .maybeSingle()
  if (error) {
    console.error('[inventory] insert error', error)
    return null
  }
  return (data as InventoryRecord | null) ?? null
}

async function updateInventoryRecord(
  id: string,
  units: number,
): Promise<InventoryRecord | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from(INVENTORY_TABLE)
    .update({ units_available: units })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) {
    console.error('[inventory] update error', error)
    return null
  }
  return (data as InventoryRecord | null) ?? null
}

export async function listInventory(): Promise<InventoryRecord[]> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from(INVENTORY_TABLE)
    .select('*')
    .order('product_name', { ascending: true })
  if (error) {
    console.error('[inventory] list error', error)
    return []
  }
  return (data as InventoryRecord[]) ?? []
}

export async function adjustInventory({
  productName,
  delta,
  setTo,
  initialUnits = DEFAULT_INITIAL_UNITS,
}: {
  productName: string
  delta?: number
  setTo?: number
  initialUnits?: number
}): Promise<InventoryRecord | null> {
  const sanitizedName = sanitizeProductName(productName)
  if (!sanitizedName) return null

  const existing = await fetchInventoryRecord(sanitizedName)
  if (!existing) {
    const startingUnits = Number.isFinite(initialUnits) ? initialUnits : DEFAULT_INITIAL_UNITS
    const nextUnits =
      typeof setTo === 'number'
        ? setTo
        : typeof delta === 'number'
        ? startingUnits + delta
        : startingUnits
    return insertInventoryRecord(sanitizedName, Math.max(0, Math.round(nextUnits)))
  }

  const currentUnits = Number(existing.units_available) || 0
  const nextUnits =
    typeof setTo === 'number'
      ? setTo
      : typeof delta === 'number'
      ? currentUnits + delta
      : currentUnits

  return updateInventoryRecord(existing.id, Math.max(0, Math.round(nextUnits)))
}

export function parseUnitsFromText(text: string | null | undefined): number {
  if (!text) return 1
  const match = text.match(/[-+]?\d+(\.\d+)?/)
  if (!match) return 1
  const value = Number(match[0])
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value))
}
