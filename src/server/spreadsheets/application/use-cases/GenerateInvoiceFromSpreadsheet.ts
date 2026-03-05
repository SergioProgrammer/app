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
}

interface GenerateInvoiceResult {
  invoices: GenerateInvoiceGroupResult[]
}

function incrementInvoiceNumber(base: string, index: number): string {
  if (index === 0) return base
  const match = base.match(/^(.*?)(\d+)$/)
  if (!match) return `${base}-${index + 1}`
  const [, prefix, numStr] = match
  const newNum = parseInt(numStr, 10) + index
  return `${prefix}${String(newNum).padStart(numStr.length, '0')}`
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
    const headerAwb = header.awb ?? ''
    const invoiceDate = header.invoiceDate ?? new Date().toISOString().slice(0, 10)

    // Group rows by AWB; rows without AWB go to the header AWB group
    const groupMap = new Map<string, SpreadsheetRowProps[]>()
    for (const rowProps of spreadsheet.rows) {
      const awb = rowProps.data.awb?.trim() || headerAwb
      if (!groupMap.has(awb)) groupMap.set(awb, [])
      groupMap.get(awb)!.push(rowProps)
    }

    // Order: header AWB first, then the rest
    const orderedAwbs: string[] = []
    if (groupMap.has(headerAwb)) orderedAwbs.push(headerAwb)
    for (const awb of groupMap.keys()) {
      if (awb !== headerAwb) orderedAwbs.push(awb)
    }

    const results: GenerateInvoiceGroupResult[] = []

    for (let groupIndex = 0; groupIndex < orderedAwbs.length; groupIndex++) {
      const groupAwb = orderedAwbs[groupIndex]
      const groupRows = groupMap.get(groupAwb)!
      const invoiceNumber = incrementInvoiceNumber(header.invoiceNumber ?? '', groupIndex)

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

      // flightNumber: first non-empty value in group rows, fallback to header
      const groupFlightNumber =
        groupRows.find((r) => r.data.flightNumber?.trim())?.data.flightNumber?.trim() ??
        header.flightNumber ??
        ''

      const payload: InvoicePayload = {
        invoiceNumber,
        invoiceDate,
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
        incoterm: header.incoterm,
        destination: header.destination,
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
        flightNumber: groupFlightNumber || undefined,
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
          transportId: groupFlightNumber && groupAwb
            ? `${groupFlightNumber} / AWB ${groupAwb}`
            : groupAwb || groupFlightNumber || '',
          location: 'S/C de TFE',
          dateText: invoiceDate,
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
      })
    }

    return { invoices: results }
  }
}
