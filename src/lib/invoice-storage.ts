import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'

export interface UploadInvoiceOptions {
  invoiceNumber: string
  invoiceDate: string
  customerName: string
  customerTaxId?: string
  total: number
  currency?: string
}

async function uploadToStorage(
  bytes: Uint8Array,
  fileName: string,
  invoiceDate: string,
  bucketName = 'facturas',
  prefix = bucketName,
  supabaseClient?: SupabaseClient,
) {
  const supabase = supabaseClient ?? createClient()
  const parsedDate = invoiceDate ? new Date(invoiceDate) : null
  const dateObj = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date()
  const year = String(dateObj.getFullYear())
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const safePrefix = prefix.replace(/^\//, '').replace(/\/$/, '')
  const path = `${safePrefix}/${year}/${month}/${fileName}`
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })

  const { data: uploadData, error: uploadError } = await supabase.storage.from(bucketName).upload(path, blob, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) {
    throw uploadError
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log('[invoice-storage] upload ok', { path, bytes: bytes.byteLength, data: uploadData })
  }

  let publicUrl: string | null = null
  let signedUrl: string | null = null
  const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(path)
  publicUrl = publicData?.publicUrl ?? null

  if (!publicUrl) {
    const { data: signed, error: signedError } = await supabase.storage.from(bucketName).createSignedUrl(path, 60 * 60 * 24)
    if (signedError) {
      throw signedError
    }
    signedUrl = signed?.signedUrl ?? null
  }
  if (!publicUrl && !signedUrl) {
    throw new Error('No se pudo obtener URL de acceso para la factura subida.')
  }
  return { supabase, path, publicUrl, signedUrl }
}

export async function uploadInvoicePdf(
  bytes: Uint8Array,
  fileName: string,
  options: UploadInvoiceOptions,
  supabaseClient?: SupabaseClient,
) {
  const { supabase, path, publicUrl, signedUrl } = await uploadToStorage(
    bytes,
    fileName,
    options.invoiceDate,
    'facturas',
    'facturas',
    supabaseClient,
  )

  try {
    await supabase.from('facturas').insert({
      invoice_number: options.invoiceNumber,
      date: options.invoiceDate,
      customer_name: options.customerName,
      customer_tax_id: options.customerTaxId ?? null,
      total: options.total,
      currency: options.currency ?? 'EUR',
      file_path: path,
    })
  } catch (error) {
    console.warn('[invoice-storage] No se pudo registrar en tabla facturas (opcional):', error)
  }

  return {
    path,
    publicUrl,
    signedUrl,
  }
}

export async function uploadSupplementPdf(
  bytes: Uint8Array,
  fileName: string,
  invoiceDate: string,
  supabaseClient?: SupabaseClient,
) {
  const { path, publicUrl, signedUrl } = await uploadToStorage(bytes, fileName, invoiceDate, 'informe', 'informe', supabaseClient)
  return { path, publicUrl, signedUrl, bucket: 'informe' }
}
