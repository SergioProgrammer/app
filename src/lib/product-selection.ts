export type LabelType =
  | 'mercadona'
  | 'aldi'
  | 'lidl'
  | 'hiperdino'
  | 'kanali'
  | 'blanca-grande'
  | 'blanca-pequena'

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
  lidl: {
    label: 'Etiqueta Lidl',
    description: 'Formato mixto que genera 3 etiquetas por pedido.',
    helper: 'Incluye etiqueta principal + 2 etiquetas blancas.',
  },
  hiperdino: {
    label: 'Etiqueta Hiperdino',
    description: 'Formato específico para la cadena Hiperdino.',
    helper: 'Incluye personalización de peso y lote.',
  },
  kanali: {
    label: 'Etiqueta Kanali',
    description: 'Diseño dedicado para Kanali.',
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
  mercadona: [
    'Albahaca',
  ],
  aldi: [
    'Acelgas',
    'Albahaca',
    'Cebollino',
    'Eneldo',
    'Pak Choi',
    'Cilantro',
    'Hierbahuerto',
    'Perejil',
    'Romero',
  ],
  lidl: [
    'Cebollino',
    'Cilantro',
    'Eneldo',
    'Hierbahuerto',
    'Perejil',
    'Romero',
    'Albahaca',
  ],
  hiperdino: [
    'Naranja',
    'Albahaca',
  ],
  kanali: [
    'Romero',
    'Cilantro',
    'Perejil',
    'Cebollino',
    'Rucula',
    'Albahaca',
    'Hierbabuena',
  ],
  'blanca-grande': [
    'Albahaca',
    'Cebolla',
    'Sandía',
    'Hierbas aromáticas',
    'Perejil',
    'Cilantro',
    'Hierbahuerto',
    'Romero',
    'Rucula',
    'Eneldo',
    'Cebollino',
    'Pak Choi',
    'Hojas frescas acelga',
    'Melón',
    'Naranja',
  ],
  'blanca-pequena': [
    'Albahaca',
    'Cebolla',
    'Sandía',
    'Hierbas aromáticas',
    'Perejil',
    'Cilantro',
    'Hierbahuerto',
    'Romero',
    'Rucula',
    'Eneldo',
    'Cebollino',
    'Pak Choi',
    'Hojas frescas acelga',
    'Melón',
    'Naranja',
  ],
}

export function normalizeLabelType(value?: string | null): LabelType {
  if (!value) return DEFAULT_LABEL_TYPE
  const normalized = value.toLowerCase()
  if (normalized.includes('aldi')) {
    return 'aldi'
  }
  if (normalized.includes('lidl')) {
    return 'lidl'
  }
  if (normalized.includes('hiper')) {
    return 'hiperdino'
  }
  if (normalized.includes('kanali')) {
    return 'kanali'
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
  const trimmed = typeof value === 'string' ? value.trim() : ''
  const allowFreeText = labelType === 'blanca-grande' || labelType === 'blanca-pequena'
  if (allowFreeText) {
    if (trimmed.length > 0) {
      return trimmed
    }
    return options[0] ?? DEFAULT_PRODUCT
  }
  if (trimmed.length === 0) {
    return options[0] ?? DEFAULT_PRODUCT
  }
  const lowerValue = trimmed.toLowerCase()
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
