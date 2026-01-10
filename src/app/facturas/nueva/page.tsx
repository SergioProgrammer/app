'use client'

import { useCallback, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Plus, TableIcon, Trash2 } from 'lucide-react'
import { parseExcelPaste, type InvoicePasteRow } from '@/lib/parseExcelPaste'
import { calculateTotals } from '@/lib/invoice-totals'
import { generateInvoicePdf } from '@/lib/invoicePdf'
import { generateAnexoIVPdf } from '@/lib/anexo-iv-pdf'
import { uploadInvoicePdf, uploadSupplementPdf } from '@/lib/supabaseInvoiceUpload'
import { createClient } from '@/utils/supabase/client'

type EditableRow = {
  product: string
  invoiceNumber: string
  awb: string
  netWeightKg: string
  price: string
  bundles: string
  total: string
}

type RowErrors = Record<number, string[]>

const emptyRow = (): EditableRow => ({
  product: '',
  invoiceNumber: '',
  awb: '',
  netWeightKg: '',
  price: '',
  bundles: '',
  total: '',
})

function toEditable(row: InvoicePasteRow): EditableRow {
  return {
    product: row.product ?? '',
    invoiceNumber: row.invoiceNumber ?? '',
    awb: row.awb ?? '',
    netWeightKg: row.netWeightKg != null ? String(row.netWeightKg) : '',
    price: row.price != null ? String(row.price) : '',
    bundles: row.bundles != null ? String(row.bundles) : '',
    total: row.total != null ? String(row.total) : '',
  }
}

function parseNumeric(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const cleaned = trimmed.replace(/[€$]/g, '').replace(/\s+/g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

export default function NuevaFacturaPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()])
  const [warnings, setWarnings] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<RowErrors>({})
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedLinks, setGeneratedLinks] = useState<
    { invoiceNumber: string; invoiceUrl?: string | null; anexoUrl?: string | null }[]
  >([])
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const [invoiceNumber, setInvoiceNumber] = useState(() => `FAC-${today.replace(/-/g, '')}`)
  const [invoiceNumberTouched, setInvoiceNumberTouched] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [clientName, setClientName] = useState('ARICO FRUITS SL')
  const [clientTaxId, setClientTaxId] = useState('B24895971')
  const [clientAddress, setClientAddress] = useState('MERCAMADRID NAVE POLIVALENCIA 21/23 · 28053 · MADRID')
  const [awb, setAwb] = useState('996-13826540')
  const [awbTouched, setAwbTouched] = useState(false)
  const [flightNumber, setFlightNumber] = useState('UX9117')
  const [destination, setDestination] = useState('MAD AIRPORT')
  const [incoterm, setIncoterm] = useState('CPT')
  const [paymentTerms, setPaymentTerms] = useState('30 days')
  const [bankName, setBankName] = useState('BANKINTER S.A.')
  const [bankIban, setBankIban] = useState('ES13 0128 0850 7301 0015 7347')
  const [bankSwift, setBankSwift] = useState('BKBKESMMXXX')
  const [productForm, setProductForm] = useState('HOJAS FRESCAS')
  const [botanicalName, setBotanicalName] = useState('Ocimum basilicum')

  const [emitterName, setEmitterName] = useState('YEOWARD DEL CAMPO SDAD COOP LTDA DE VECINDARIO LAS PALMAS')
  const [emitterTaxId, setEmitterTaxId] = useState('F35077700')
  const [emitterAddress, setEmitterAddress] = useState(
    'AVDA CANARIAS NUM 249 · 35110 SANTA LUCIA DE TIRAJANA · LAS PALMAS DE GRAN CANARIA',
  )

  const handleProcess = useCallback(() => {
    setWarnings([])
    setRowErrors({})
    setStatus(null)
    setError(null)
    const result = parseExcelPaste(rawText)
    if (result.rows.length === 0) {
      setWarnings(result.warnings)
      setRows([emptyRow()])
      return
    }
    if (result.header.invoiceNumber && (!invoiceNumberTouched || invoiceNumber.trim().length === 0)) {
      setInvoiceNumber(result.header.invoiceNumber)
    }
    if (result.header.awb && (!awbTouched || awb.trim().length === 0)) {
      setAwb(result.header.awb)
    }
    setRows(result.rows.map(toEditable))
    setWarnings(result.warnings)
  }, [awb, awbTouched, invoiceNumber, invoiceNumberTouched, rawText])

  const addRow = () => setRows((current) => [...current, emptyRow()])
  const removeRow = (index: number) =>
    setRows((current) => current.filter((_, idx) => idx !== index))

  const updateCell = (index: number, key: keyof EditableRow, value: string) => {
    setRows((current) => {
      const next = [...current]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  const validateRows = (): { valid: InvoicePasteRow[]; hasErrors: boolean } => {
    const errors: RowErrors = {}
    const updatedRows: EditableRow[] = [...rows]
    const validRows: InvoicePasteRow[] = []

    rows.forEach((row, idx) => {
      const rowMsgs: string[] = []
      const product = row.product.trim()
      const rowInvoiceNumber = row.invoiceNumber.trim()
      const rowAwb = row.awb.trim()
      const netWeight = parseNumeric(row.netWeightKg)
      const price = parseNumeric(row.price)
      const bundles = parseNumeric(row.bundles)
      const total = parseNumeric(row.total)

      const computedTotal =
        total != null
          ? total
          : netWeight != null && price != null
          ? Number((netWeight * price).toFixed(2))
          : undefined

      if (computedTotal != null && row.total.trim().length === 0) {
        updatedRows[idx] = {
          ...row,
          total: computedTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        }
      }

      const isEmpty = !product && netWeight == null && price == null && bundles == null && computedTotal == null
      if (isEmpty) {
        return
      }

      if (!product) {
        rowMsgs.push('Producto requerido')
      }
      if (computedTotal == null) {
        rowMsgs.push('Importe total requerido (o peso + precio)')
      }

      if (rowMsgs.length > 0) {
        errors[idx] = rowMsgs
      } else {
        validRows.push({
          product,
          invoiceNumber: rowInvoiceNumber || undefined,
          awb: rowAwb || undefined,
          netWeightKg: netWeight,
          price,
          bundles,
          total: computedTotal,
        })
      }
    })

    setRowErrors(errors)
    // Actualiza la tabla visible con el importe calculado cuando falte.
    setRows(updatedRows)
    return { valid: validRows, hasErrors: Object.keys(errors).length > 0 }
  }

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    setError(null)
    setGeneratedLinks([])
    const { valid, hasErrors } = validateRows()
    if (hasErrors || valid.length === 0) {
      setLoading(false)
      setError('Revisa la tabla: cada fila necesita Producto e Importe (o Peso+Precio).')
      return
    }

    try {
      const fallbackInvoiceNumber = invoiceNumber.trim()
      if (!fallbackInvoiceNumber) {
        setLoading(false)
        setError('Indica un número de factura en la cabecera o en las filas.')
        return
      }

      const grouped = new Map<string, InvoicePasteRow[]>()
      valid.forEach((row) => {
        const key = row.invoiceNumber?.trim() || fallbackInvoiceNumber
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(row)
      })

      const nextLinks: { invoiceNumber: string; invoiceUrl?: string | null; anexoUrl?: string | null }[] = []
      for (const [groupInvoiceNumber, items] of grouped.entries()) {
        const totals = calculateTotals(items)
        const groupAwb =
          items.find((item) => item.awb && item.awb.trim().length > 0)?.awb?.trim() || awb.trim()

        const { pdfBytes, fileName } = await generateInvoicePdf({
          invoiceNumber: groupInvoiceNumber,
          invoiceDate,
          destination,
          incoterm,
          ggnOrCoc: 'GGN CERTIFIED / CoC 4063061964472',
          paymentTerms,
          awb: groupAwb,
          flightNumber,
          emitter: {
            name: emitterName,
            taxId: emitterTaxId,
            address: emitterAddress,
          },
          receiver: {
            name: clientName,
            taxId: clientTaxId,
            address: clientAddress,
          },
          bankInfo: {
            bankName,
            iban: bankIban,
            swift: bankSwift,
          },
          grossWeight: totals.totalGrossKg,
          netWeight: totals.totalNetKg,
          items: items.map((row) => ({
            product: row.product,
            netWeightKg: row.netWeightKg ?? 0,
            pricePerKg: row.price ?? 0,
            bundles: row.bundles,
            total: row.total ?? 0,
          })),
          igicRate: 0,
          totals: { totalBundles: totals.totalBundles, totalKg: totals.totalNetKg },
        })

        const upload = await uploadInvoicePdf(pdfBytes, fileName, {
          invoiceDate,
          invoiceNumber: groupInvoiceNumber,
          customerName: clientName,
          customerTaxId: clientTaxId,
          total: totals.totalAmount,
          currency: 'EUR',
        })

        const invoiceUrl = upload.publicUrl ?? upload.signedUrl ?? null

        const anexoData = {
          companyName: emitterName,
          companyTaxId: emitterTaxId,
          signerName: 'ANTONIO GUEDES',
          signerId: '43278677Z',
          signerRole: 'PRESIDENTE',
          productName: items[0]?.product ?? 'Producto',
          netWeightKg: totals.totalNetKg,
          grossWeightKg: totals.totalGrossKg,
          form: 'HOJAS FRESCAS',
          botanicalName: 'Ocimum basilicum',
          packageType: 'CAJAS BOX',
          packageMark: 'RTDOS',
          bundles: totals.totalBundles,
          transportId: `${flightNumber} - AWB ${groupAwb || awb}`,
          location: 'S/C de TFE',
          dateText: new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(
            new Date(invoiceDate),
          ),
          invoiceNumber: groupInvoiceNumber,
          items: items.map((row) => ({
            productName: row.product,
            netWeightKg: row.netWeightKg ?? 0,
            form: productForm,
            botanicalName,
          })),
        }

        const { pdfBytes: anexoBytes, fileName: anexoFileName } = await generateAnexoIVPdf(anexoData)
        const anexoUpload = await uploadSupplementPdf(anexoBytes, anexoFileName, invoiceDate)
        const anexoAccessUrl = anexoUpload.publicUrl ?? anexoUpload.signedUrl ?? null

        try {
          await supabase
            .from('facturas')
            .update({ anexo_path: anexoUpload.path })
            .eq('file_path', upload.path)
        } catch (updateError) {
          console.warn('[facturas/nueva] No se pudo actualizar anexo_path:', updateError)
        }

        nextLinks.push({ invoiceNumber: groupInvoiceNumber, invoiceUrl, anexoUrl: anexoAccessUrl })
      }

      setGeneratedLinks(nextLinks)
      setStatus(`Facturas y anexos generados y subidos correctamente.`)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(`No se pudo generar o subir la factura/anexo: ${message}`)
    } finally {
      setLoading(false)
    }
  }, [
    clientAddress,
    clientName,
    clientTaxId,
    emitterAddress,
    emitterName,
    emitterTaxId,
    invoiceDate,
    invoiceNumber,
    destination,
    incoterm,
    paymentTerms,
    awb,
    flightNumber,
    bankName,
    bankIban,
    bankSwift,
    productForm,
    botanicalName,
    rows,
    supabase,
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-gray-500">Facturación</p>
          <h1 className="text-2xl font-semibold text-gray-900">Nueva factura</h1>
          <p className="text-sm text-gray-600">Pega desde Excel, revisa y genera la factura.</p>
        </div>
      </div>

      {(status || error || warnings.length > 0) && (
        <div className="space-y-2">
          {status && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              <span>{status}</span>
              {generatedLinks.length > 0 && (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {generatedLinks.map((link) => (
                    <div key={link.invoiceNumber} className="flex items-center gap-2">
                      {link.invoiceUrl && (
                        <a
                          href={link.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold underline"
                        >
                          Factura {link.invoiceNumber}
                        </a>
                      )}
                      {link.anexoUrl && (
                        <a
                          href={link.anexoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold underline"
                        >
                          Anexo IV {link.invoiceNumber}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {(error || warnings.length > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 space-y-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error || 'Revisa estos avisos'}</span>
              </div>
              {warnings.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-amber-800 space-y-0.5">
                  {warnings.map((warn) => (
                    <li key={warn}>{warn}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Datos de cabecera</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-gray-700">
                Número de factura
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(event) => {
                    setInvoiceNumberTouched(true)
                    setInvoiceNumber(event.target.value)
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                Fecha
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700 sm:col-span-2">
                Cliente (nombre)
                <input
                  type="text"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                Cliente CIF/NIF
                <input
                  type="text"
                  value={clientTaxId}
                  onChange={(event) => setClientTaxId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700 sm:col-span-2">
                Cliente dirección
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(event) => setClientAddress(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700 sm:col-span-2">
                Emisor (nombre)
                <input
                  type="text"
                  value={emitterName}
                  onChange={(event) => setEmitterName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                Emisor CIF/NIF
                <input
                  type="text"
                  value={emitterTaxId}
                  onChange={(event) => setEmitterTaxId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700 sm:col-span-2">
                Emisor dirección
                <input
                  type="text"
                  value={emitterAddress}
                  onChange={(event) => setEmitterAddress(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                Destino
                <input
                  type="text"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                AWB
                <input
                  type="text"
                  value={awb}
                  onChange={(event) => {
                    setAwbTouched(true)
                    setAwb(event.target.value)
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                Nº de vuelo
                <input
                  type="text"
                  value={flightNumber}
                  onChange={(event) => setFlightNumber(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                Incoterm
                <input
                  type="text"
                  value={incoterm}
                  onChange={(event) => setIncoterm(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700 sm:col-span-2">
                Payment due
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                Forma
                <input
                  type="text"
                  value={productForm}
                  onChange={(event) => setProductForm(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700">
                Nombre botánico
                <input
                  type="text"
                  value={botanicalName}
                  onChange={(event) => setBotanicalName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700 sm:col-span-2">
                Banco
                <input
                  type="text"
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700 sm:col-span-2">
                IBAN
                <input
                  type="text"
                  value={bankIban}
                  onChange={(event) => setBankIban(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-700 sm:col-span-2">
                SWIFT/BIC
                <input
                  type="text"
                  value={bankSwift}
                  onChange={(event) => setBankSwift(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Pega desde Excel</h2>
            <p className="text-sm text-gray-600">
              Formato recomendado TSV (tab). Columnas: Producto · Peso neto (kg) · Precio · Bultos · Importe total.
            </p>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={6}
              placeholder="Ej. BASIL\t620\t7,50\t124\t4650"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <button
              type="button"
              onClick={handleProcess}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Procesar pegado
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Detalle editable</h2>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Añadir fila
              </button>
            </div>
            <div className="overflow-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Factura', 'AWB', 'Producto', 'Peso neto (kg)', 'Precio', 'Bultos', 'Importe total', ''].map(
                      (col, idx) => (
                      <th key={col} className="px-3 py-2 text-left font-semibold text-gray-700">
                        {idx === 7 ? '' : col}
                      </th>
                    ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const errors = rowErrors[idx] ?? []
                    return (
                      <tr key={idx} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.invoiceNumber}
                            onChange={(event) => updateCell(idx, 'invoiceNumber', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.awb}
                            onChange={(event) => updateCell(idx, 'awb', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.product}
                            onChange={(event) => updateCell(idx, 'product', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.netWeightKg}
                            onChange={(event) => updateCell(idx, 'netWeightKg', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.price}
                            onChange={(event) => updateCell(idx, 'price', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.bundles}
                            onChange={(event) => updateCell(idx, 'bundles', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.total}
                            onChange={(event) => updateCell(idx, 'total', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-right"
                          />
                          {errors.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-[11px] text-red-600">
                              {errors.map((err) => (
                                <li key={err}>{err}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            aria-label="Eliminar fila"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                        Sin filas. Pega datos o añade manualmente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${
            loading ? 'bg-gray-400' : 'bg-emerald-600 hover:opacity-90'
          }`}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Generar
        </button>
      </div>
    </div>
  )
}
