import type { DayOfWeek, SpreadsheetDetail, SpreadsheetListItem } from '../types'

const BASE = '/api/spreadsheets'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export function listSpreadsheets(): Promise<SpreadsheetListItem[]> {
  return request<SpreadsheetListItem[]>(BASE)
}

export function listTrash(): Promise<SpreadsheetListItem[]> {
  return request<SpreadsheetListItem[]>(`${BASE}/trash`)
}

export function getSpreadsheet(id: string): Promise<SpreadsheetDetail> {
  return request<SpreadsheetDetail>(`${BASE}/${id}`)
}

export function createSpreadsheet(
  name: string,
  options?: { dayOfWeek?: DayOfWeek; copyFromPrevious?: boolean },
): Promise<SpreadsheetDetail> {
  return request<SpreadsheetDetail>(BASE, {
    method: 'POST',
    body: JSON.stringify({ name, ...options }),
  })
}

export function updateSpreadsheet(
  id: string,
  data: {
    name?: string
    headerData?: Record<string, string>
    rows?: Array<{
      id?: string
      position: number
      [key: string]: unknown
    }>
  },
): Promise<SpreadsheetDetail> {
  return request<SpreadsheetDetail>(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function archiveSpreadsheet(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE}/${id}/archive`, { method: 'POST' })
}

export function restoreSpreadsheet(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE}/${id}/restore`, { method: 'POST' })
}

export function deleteSpreadsheet(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE}/${id}`, { method: 'DELETE' })
}

export interface GenerateInvoiceGroupResult {
  awb: string
  invoiceNumber: string
  invoiceUrl: string | null
  anexoUrl: string | null
}

export function generateInvoice(
  id: string,
): Promise<{ invoices: GenerateInvoiceGroupResult[] }> {
  return request(`${BASE}/${id}/generate-invoice`, { method: 'POST' })
}
