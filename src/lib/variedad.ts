export type ProductoBaseVariedad =
  | 'ACELGA'
  | 'ALBAHACA'
  | 'CEBOLLINO'
  | 'ENELDO'
  | 'PAK CHOI'
  | 'CILANTRO'
  | 'HIERBAHUERTO'
  | 'PEREJIL'
  | 'ROMERO'

const DEFAULT_VARIEDAD_BY_PRODUCTO: Record<ProductoBaseVariedad, string> = {
  ACELGA: 'LOUISIANA',
  ALBAHACA: 'GENOVESA',
  CEBOLLINO: 'DOLORES',
  ENELDO: 'DUKAT',
  'PAK CHOI': 'GOKU',
  CILANTRO: 'CRUISER',
  HIERBAHUERTO: 'CANARIA',
  PEREJIL: 'ITALIANO',
  ROMERO: 'EUROPEO',
}

function normalizeComparableText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function getProductoBaseForVariedad(productName: string | null | undefined): ProductoBaseVariedad | null {
  if (typeof productName !== 'string') return null
  const normalized = normalizeComparableText(productName)
  if (!normalized) return null

  if (normalized.includes('ALBAHACA')) return 'ALBAHACA'
  if (normalized.includes('CEBOLLINO')) return 'CEBOLLINO'
  if (normalized.includes('ENELDO')) return 'ENELDO'
  if (normalized.includes('CILANTRO')) return 'CILANTRO'
  if (normalized.includes('PEREJIL')) return 'PEREJIL'
  if (normalized.includes('ROMERO')) return 'ROMERO'

  if (normalized.includes('ACELGA')) return 'ACELGA'
  if (normalized.includes('PAKCHOI') || (normalized.includes('PAK') && normalized.includes('CHOI'))) {
    return 'PAK CHOI'
  }

  if (normalized.includes('HIERBAHUERTO') || normalized.includes('HIERBABUENA')) {
    return 'HIERBAHUERTO'
  }

  return null
}

export function getDefaultVariedad(productName: string | null | undefined): string | null {
  const base = getProductoBaseForVariedad(productName)
  if (!base) return null
  return DEFAULT_VARIEDAD_BY_PRODUCTO[base] ?? null
}

export function isLegacyVariedadDefault(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false
  const normalized = normalizeComparableText(value)
  return normalized === 'RED JASPER'
}

