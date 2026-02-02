import { z } from 'zod'

export const CreateSpreadsheetSchema = z.object({
  name: z.string().min(1).max(200).default('Sin nombre'),
})

export type CreateSpreadsheetRequest = z.infer<typeof CreateSpreadsheetSchema>

const RowSchema = z.object({
  id: z.string().uuid().optional(),
  position: z.number().int().min(0),
  week: z.string().nullable().default(null),
  invoiceDate: z.string().nullable().default(null),
  date: z.string().nullable().default(null),
  finalClient: z.string().nullable().default(null),
  kg: z.number().nullable().default(null),
  product: z.string().nullable().default(null),
  boxType: z.string().nullable().default(null),
  bundles: z.number().int().nullable().default(null),
  price: z.number().nullable().default(null),
  orderNumber: z.string().nullable().default(null),
  awb: z.string().nullable().default(null),
  deliveryNote: z.string().nullable().default(null),
  invoiceNumber: z.string().nullable().default(null),
  line: z.string().nullable().default(null),
  search: z.string().nullable().default(null),
})

const HeaderDataSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  clientName: z.string().optional(),
  clientTaxId: z.string().optional(),
  clientAddress: z.string().optional(),
  emitterName: z.string().optional(),
  emitterTaxId: z.string().optional(),
  emitterAddress: z.string().optional(),
  destination: z.string().optional(),
  incoterm: z.string().optional(),
  awb: z.string().optional(),
  flightNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  bankSwift: z.string().optional(),
  productForm: z.string().optional(),
  botanicalName: z.string().optional(),
})

export const UpdateSpreadsheetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  headerData: HeaderDataSchema.optional(),
  rows: z.array(RowSchema).optional(),
})

export type UpdateSpreadsheetRequest = z.infer<typeof UpdateSpreadsheetSchema>
