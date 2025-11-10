export type LabelType = 'mercadona' | 'aldi' | 'blanca-grande' | 'blanca-pequena'

export interface ProductSelection {
  labelType: LabelType
  productName: string
  savedAt?: string
}

export const PRODUCT_SELECTION_STORAGE_KEY = 'labels:product-selection'
export const DEFAULT_LABEL_TYPE: LabelType = 'mercadona'
export const DEFAULT_PRODUCT = 'Albahaca'

export const LABEL_TYPE_OPTIONS: Record<
  LabelType,
  {
    label: string
    description: string
    helper?: string
  }
> = {
  mercadona: {
    label: 'Etiqueta Mercadona',
    description: 'Formato con layout fijo para Mercadona.',
    helper: 'En esta fase de pruebas no necesitas adjuntar el pedido.',
  },
  aldi: {
    label: 'Etiqueta Aldi',
    description: 'Selecciona este formato para pedidos de Aldi.',
  },
  'blanca-grande': {
    label: 'Etiqueta blanca grande',
    description: 'Formato genérico de mayor tamaño.',
  },
  'blanca-pequena': {
    label: 'Etiqueta blanca pequeña',
    description: 'Formato compacto para tiradas cortas.',
  },
}

export const LABEL_TYPE_PRODUCTS: Record<LabelType, string[]> = {
  mercadona: ['Albahaca'],
  aldi: ['Albahaca', 'Cebolla', 'Sandía', 'Hierbas aromáticas'],
  'blanca-grande': ['Albahaca', 'Cebolla', 'Sandía', 'Hierbas aromáticas'],
  'blanca-pequena': ['Albahaca', 'Cebolla', 'Sandía', 'Hierbas aromáticas'],
}

export function normalizeLabelType(value?: string | null): LabelType {
  if (!value) return DEFAULT_LABEL_TYPE
  const normalized = value.toLowerCase()
  if (normalized.includes('aldi')) {
    return 'aldi'
  }
  if (normalized.includes('blanca') && normalized.includes('peque')) {
    return 'blanca-pequena'
  }
  if (normalized.includes('blanca') && normalized.includes('gran')) {
    return 'blanca-grande'
  }
  return 'mercadona'
}

export function getLabelTypeLabel(value: LabelType): string {
  return LABEL_TYPE_OPTIONS[value]?.label ?? LABEL_TYPE_OPTIONS[DEFAULT_LABEL_TYPE].label
}

export function normalizeProductForLabelType(labelType: LabelType, value?: string | null): string {
  const options = LABEL_TYPE_PRODUCTS[labelType]
  if (!value) {
    return options[0] ?? DEFAULT_PRODUCT
  }
  const lowerValue = value.toLowerCase()
  const match = options.find((option) => option.toLowerCase() === lowerValue)
  return match ?? (options[0] ?? DEFAULT_PRODUCT)
}

export function parseStoredProductSelection(rawValue: string | null): ProductSelection | null {
  if (!rawValue) return null
  try {
    const parsed = JSON.parse(rawValue) as Partial<ProductSelection> & { retailer?: string }
    const labelType = normalizeLabelType(parsed?.labelType ?? parsed?.retailer)
    const productName = normalizeProductForLabelType(labelType, parsed?.productName)
    return {
      labelType,
      productName,
      savedAt: typeof parsed?.savedAt === 'string' ? parsed.savedAt : undefined,
    }
  } catch {
    return null
  }
}
