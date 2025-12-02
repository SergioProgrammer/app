import type { LabelType } from '@/lib/product-selection'

export interface LabelRenderFields {
  fechaEnvasado?: string | null
  lote?: string | null
  labelCode?: string | null
  codigoCoc?: string | null
  codigoR?: string | null
  weight?: string | null
  labelType?: LabelType | null
  productName?: string | null
  variety?: string | null
}

export interface LabelRenderResult {
  buffer: Buffer
  fileName: string
  mimeType: string
  storageBucket?: string
}

export interface WhiteLabelLine {
  text: string
  size?: number
  spacing?: number
  align?: 'left' | 'center' | 'right'
}
