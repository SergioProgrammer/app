import type { SupabaseClient } from '@supabase/supabase-js'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import type { InvoicePayload } from '@/lib/invoice-pdf'
import { generateAnexoIVPdf } from '@/lib/anexo-iv-pdf'
import { uploadInvoicePdf, uploadSupplementPdf } from '@/lib/invoice-storage'
import type { InvoicePasteRow } from '@/lib/parseExcelPaste'
import { calculateTotals } from '@/lib/invoice-totals'
import { SpreadsheetRow } from '../../domain/entities/SpreadsheetRow'
import type { SpreadsheetRepository } from '../../domain/repositories/SpreadsheetRepository'

interface GenerateInvoiceResult {
  invoiceUrl: string | null
  anexoUrl: string | null
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
    const invoiceItems = spreadsheet.rows.map((rowProps) => {
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
      invoiceNumber: header.invoiceNumber ?? '',
      invoiceDate: header.invoiceDate ?? new Date().toISOString().slice(0, 10),
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
      awb: header.awb,
      flightNumber: header.flightNumber,
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
        form: header.productForm ?? '',
        botanicalName: header.botanicalName ?? '',
        packageType: 'CAJAS BOX',
        packageMark: 'RTDOS',
        bundles: totals.totalBundles,
        transportId: header.flightNumber && header.awb
          ? `${header.flightNumber} / AWB ${header.awb}`
          : header.awb ?? header.flightNumber ?? '',
        location: 'S/C de TFE',
        dateText: payload.invoiceDate,
        invoiceNumber: payload.invoiceNumber,
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
        payload.invoiceDate,
        this.supabaseClient,
      )
      anexoUrl = anexoResult.publicUrl ?? anexoResult.signedUrl ?? null

      // Actualizar anexo_path en la tabla facturas
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

    return {
      invoiceUrl: invoiceResult.publicUrl ?? invoiceResult.signedUrl ?? null,
      anexoUrl,
    }
  }
}
