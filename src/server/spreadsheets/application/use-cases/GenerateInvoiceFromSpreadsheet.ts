import type { SupabaseClient } from '@supabase/supabase-js'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import type { InvoicePayload } from '@/lib/invoice-pdf'
import { generateAnexoIVPdf } from '@/lib/anexo-iv-pdf'
import { uploadInvoicePdf, uploadSupplementPdf } from '@/lib/invoice-storage'
import type { InvoicePasteRow } from '@/lib/parseExcelPaste'
import { calculateTotals } from '@/lib/invoice-totals'
import { SpreadsheetRow } from '../../domain/entities/SpreadsheetRow'
import type { SpreadsheetRowProps } from '../../domain/types'
import type { SpreadsheetRepository } from '../../domain/repositories/SpreadsheetRepository'

interface GenerateInvoiceGroupResult {
  awb: string
  invoiceNumber: string
  invoiceUrl: string | null
  anexoUrl: string | null
  warnings: string[]
  error?: string
}

interface GenerateInvoiceResult {
  invoices: GenerateInvoiceGroupResult[]
  warnings: string[]
}

const MAX_INVOICE_GROUPS = 10

type GroupFieldKey = 'invoiceNumber' | 'invoiceDate' | 'destination' | 'incoterm' | 'flightNumber'

const GROUP_FIELD_LABELS: Record<GroupFieldKey, string> = {
  invoiceNumber: 'Nº factura',
  invoiceDate: 'Fecha factura',
  destination: 'Destino',
  incoterm: 'Incoterm',
  flightNumber: 'Nº vuelo',
}

function getFieldValue(row: SpreadsheetRowProps, key: GroupFieldKey): string {
  return (row.data[key] ?? '').trim()
}

function rowNumber(row: SpreadsheetRowProps): number {
  return row.position + 1
}

function formatRows(rows: number[]): string {
  return rows.map((n) => `${n}`).join(', ')
}

function validateRequiredAwb(rows: SpreadsheetRowProps[]): void {
  const missingRows = rows.filter((row) => !row.data.awb?.trim()).map(rowNumber)
  if (missingRows.length > 0) {
    throw new Error(`Falta AWB en las filas: ${formatRows(missingRows)}.`)
  }
}

function validateGroupConsistency(awb: string, rows: SpreadsheetRowProps[]): Record<GroupFieldKey, string> {
  const resolved = {} as Record<GroupFieldKey, string>
  const keys: GroupFieldKey[] = ['invoiceNumber', 'invoiceDate', 'destination', 'incoterm', 'flightNumber']

  for (const key of keys) {
    const missingRows: number[] = []
    const values = new Map<string, number[]>()

    for (const row of rows) {
      const value = getFieldValue(row, key)
      if (!value) {
        missingRows.push(rowNumber(row))
        continue
      }
      const bucket = values.get(value) ?? []
      bucket.push(rowNumber(row))
      values.set(value, bucket)
    }

    if (missingRows.length > 0) {
      throw new Error(`AWB ${awb}: el campo "${GROUP_FIELD_LABELS[key]}" es obligatorio en filas ${formatRows(missingRows)}.`)
    }

    if (values.size > 1) {
      const detail = [...values.entries()]
        .map(([value, positions]) => `"${value}" (filas ${formatRows(positions)})`)
        .join('; ')
      throw new Error(`AWB ${awb}: el campo "${GROUP_FIELD_LABELS[key]}" debe ser único por grupo. Valores detectados: ${detail}.`)
    }

    resolved[key] = [...values.keys()][0]
  }

  return resolved
}

export class GenerateInvoiceFromSpreadsheet {
  constructor(
    private readonly repository: SpreadsheetRepository,
    private readonly supabaseClient: SupabaseClient,
  ) {}

  async execute(id: string, userId: string): Promise<GenerateInvoiceResult> {
    const spreadsheet = await this.repository.findById(id)
    if (!spreadsheet) {
      throw new Error('Spreadsheet not found')
    }
    if (spreadsheet.userId !== userId) {
      throw new Error('Forbidden')
    }
    if (spreadsheet.rows.length === 0) {
      throw new Error('Spreadsheet has no rows')
    }

    const header = spreadsheet.headerData
    validateRequiredAwb(spreadsheet.rows)

    // Group rows strictly by row AWB.
    const groupMap = new Map<string, SpreadsheetRowProps[]>()
    for (const rowProps of spreadsheet.rows) {
      const awb = rowProps.data.awb?.trim() ?? ''
      if (!groupMap.has(awb)) groupMap.set(awb, [])
      groupMap.get(awb)!.push(rowProps)
    }

    const orderedAwbs = [...groupMap.keys()]

    if (orderedAwbs.some((awb) => !awb.trim())) {
      throw new Error('Todas las filas deben tener un AWB asignado.')
    }

    if (orderedAwbs.length > MAX_INVOICE_GROUPS) {
      throw new Error(
        `Demasiados AWBs distintos (${orderedAwbs.length}). El máximo permitido es ${MAX_INVOICE_GROUPS} facturas por hoja.`,
      )
    }

    const results: GenerateInvoiceGroupResult[] = []
    const globalWarnings: string[] = []

    for (let groupIndex = 0; groupIndex < orderedAwbs.length; groupIndex++) {
      const groupAwb = orderedAwbs[groupIndex]
      const groupRows = groupMap.get(groupAwb) ?? []
      const groupData = validateGroupConsistency(groupAwb, groupRows)
      const invoiceNumber = groupData.invoiceNumber

      try {
      const invoiceItems = groupRows.map((rowProps) => {
        const row = new SpreadsheetRow(rowProps)
        return row.toInvoiceItem()
      })

      const pasteRows: InvoicePasteRow[] = invoiceItems.map((item) => ({
        product: item.product,
        netWeightKg: item.netWeightKg,
        price: item.pricePerKg,
        bundles: item.bundles,
        total: item.total,
      }))

      const totals = calculateTotals(pasteRows)

      const payload: InvoicePayload = {
        invoiceNumber,
        invoiceDate: groupData.invoiceDate,
        emitter: {
          name: header.emitterName ?? '',
          taxId: header.emitterTaxId ?? '',
          address: header.emitterAddress ?? '',
        },
        receiver: {
          name: header.clientName ?? '',
          taxId: header.clientTaxId ?? '',
          address: header.clientAddress ?? '',
        },
        incoterm: groupData.incoterm,
        destination: groupData.destination,
        paymentTerms: header.paymentTerms,
        bankInfo: header.bankName
          ? {
              bankName: header.bankName,
              iban: header.bankIban ?? '',
              swift: header.bankSwift ?? '',
            }
          : undefined,
        items: invoiceItems,
        totals: {
          totalKg: totals.totalNetKg,
          totalBundles: totals.totalBundles,
        },
        grossWeight: totals.totalGrossKg,
        awb: groupAwb || undefined,
        flightNumber: groupData.flightNumber || undefined,
      }

      const { pdfBytes: invoiceBytes, fileName: invoiceFileName } =
        await generateInvoicePdf(payload)

      const invoiceResult = await uploadInvoicePdf(
        invoiceBytes,
        invoiceFileName,
        {
          invoiceNumber: payload.invoiceNumber,
          invoiceDate: payload.invoiceDate,
          customerName: payload.receiver.name,
          customerTaxId: payload.receiver.taxId,
          total: totals.totalAmount,
        },
        this.supabaseClient,
      )

      let anexoUrl: string | null = null
      try {
        const { pdfBytes: anexoBytes, fileName: anexoFileName } = await generateAnexoIVPdf({
          companyName: header.emitterName ?? '',
          companyTaxId: header.emitterTaxId ?? '',
          signerName: header.emitterName ?? '',
          signerId: header.emitterTaxId ?? '',
          signerRole: 'Exportador',
          productName: invoiceItems[0]?.product ?? '',
          netWeightKg: totals.totalNetKg,
          grossWeightKg: totals.totalGrossKg,
          form: header.productForm ?? '',
          botanicalName: header.botanicalName ?? '',
          packageType: 'CAJAS BOX',
          packageMark: 'RTDOS',
          bundles: totals.totalBundles,
          transportId: groupData.flightNumber && groupAwb
            ? `${groupData.flightNumber} / AWB ${groupAwb}`
            : groupAwb || groupData.flightNumber || '',
          location: 'S/C de TFE',
          dateText: groupData.invoiceDate,
          invoiceNumber,
          items: invoiceItems.map((item) => ({
            productName: item.product,
            netWeightKg: item.netWeightKg,
            form: header.productForm,
            botanicalName: header.botanicalName,
          })),
        })

        const anexoResult = await uploadSupplementPdf(
          anexoBytes,
          anexoFileName,
          invoiceDate,
          this.supabaseClient,
        )
        anexoUrl = anexoResult.publicUrl ?? anexoResult.signedUrl ?? null

        if (anexoResult.path) {
          try {
            await this.supabaseClient
              .from('facturas')
              .update({ anexo_path: anexoResult.path })
              .eq('file_path', invoiceResult.path)
          } catch {
            // No bloquear si falla la actualización del anexo_path
          }
        }
      } catch {
        // Anexo generation is optional, don't fail the whole operation
      }

      results.push({
        awb: groupAwb,
        invoiceNumber,
        invoiceUrl: invoiceResult.publicUrl ?? invoiceResult.signedUrl ?? null,
        anexoUrl,
        warnings: [],
      })
      } catch (err) {
        results.push({
          awb: groupAwb,
          invoiceNumber,
          invoiceUrl: null,
          anexoUrl: null,
          warnings: [],
          error: err instanceof Error ? err.message : 'Error desconocido',
        })
      }
    }

    return { invoices: results, warnings: globalWarnings }
  }
}
