import type { VisionOrderParseResult, VisionOrderItem } from '@/lib/vision-orders'
import { buildVisionOrderItemId, deriveLabelTypeFromClient, sanitizeProductName } from '@/lib/vision-orders'
import type { VisionOrderTable } from '@/lib/vision-orders'
import * as XLSX from 'xlsx'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini'
const QUANTITY_COLUMN_INDEX = 27
const PRODUCT_COLUMN_INDEX = 5

async function callOpenAiVision({
  buffer,
  mimeType,
  fileName,
}: {
  buffer: Buffer
  mimeType: string
  fileName: string
}): Promise<{ client: string; items: Array<{ product: string; quantity: string }>; rawText?: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada')
  }
  // Enviamos tanto imágenes como PDFs como data URL; los modelos de visión aceptan image_url con application/pdf.
  const imageUrl = `data:${mimeType || 'application/pdf'};base64,${buffer.toString('base64')}`

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente que lee albaranes o pedidos y devuelve solo JSON. Extrae productos, cantidades y la empresa/cliente.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Devuelve JSON con {client, items: [{product, quantity}], raw_text}' },
            { type: 'text', text: `Archivo: ${fileName}` },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI Vision error: ${response.status} ${text}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  const parsed = safeJsonParse(content)
  if (!parsed) {
    throw new Error('No se pudo parsear la respuesta de la API de visión')
  }
  const client =
    typeof parsed.client === 'string'
      ? parsed.client
      : typeof parsed.cliente === 'string'
      ? parsed.cliente
      : ''
  const rawText =
    typeof parsed.raw_text === 'string'
      ? parsed.raw_text
      : typeof parsed.rawText === 'string'
      ? parsed.rawText
      : content
  return {
    client,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    rawText,
  }
}

type ParsedVisionOrder = {
  client?: string
  cliente?: string
  items?: unknown
  raw_text?: string
  rawText?: string
  [key: string]: unknown
}

function safeJsonParse(content: string): ParsedVisionOrder | null {
  try {
    const cleaned = content.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned) as ParsedVisionOrder
  } catch {
    return null
  }
}

function buildItems(parsedItems: Array<{ product?: string; quantity?: string }>): VisionOrderItem[] {
  return parsedItems.map((item, index) => {
    const productName = sanitizeProductName(item.product ?? '')
    const quantityText = (item.quantity ?? '').toString().trim() || '1 ud'
    const client = ''
    return {
      id: buildVisionOrderItemId(productName, index),
      productName,
      quantityText,
      client,
      labelType: deriveLabelTypeFromClient(),
      include: true,
    }
  })
}

type SpreadsheetRecord = Record<string, unknown>

function normalizeHeader(value: string): string {
  return value.toLowerCase().trim()
}

function pickFirstKey(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((header) => normalizeHeader(header))
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate)
    const index = normalized.indexOf(normalizedCandidate)
    if (index >= 0) {
      return headers[index]
    }
  }
  return null
}

function coerceQuantity(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value} ud`
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '1 ud'
    return trimmed
  }
  return '1 ud'
}

function parseUnitsFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    const match = value.match(/([0-9]+(?:[.,][0-9]+)?)/)
    if (match) {
      const parsed = Number.parseFloat(match[1].replace(',', '.'))
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed)
      }
    }
  }
  return null
}

function buildItemsFromRecords(records: SpreadsheetRecord[]): { items: VisionOrderItem[]; client: string } {
  if (records.length === 0) {
    return { items: [], client: '' }
  }

  const headers = Object.keys(records[0] ?? {})
  const forcedProductKey = headers[PRODUCT_COLUMN_INDEX] ?? null
  const forcedQuantityKey = headers[QUANTITY_COLUMN_INDEX] ?? null
  const productKey =
    forcedProductKey ??
    pickFirstKey(headers, ['producto', 'product', 'descripcion', 'description', 'articulo', 'item', 'nombre']) ??
    headers[0] ??
    ''
  const quantityKey =
    forcedQuantityKey ??
    pickFirstKey(headers, ['cantidad', 'qty', 'unidades', 'uds', 'cantidad_pedida', 'cant']) ??
    headers[1] ??
    ''
  const clientKey = pickFirstKey(headers, ['cliente', 'client', 'destino'])

  const items: VisionOrderItem[] = []

  for (let index = 0; index < records.length; index++) {
    const row = records[index]
    const productRaw = row?.[productKey]
    const productName = sanitizeProductName(
      typeof productRaw === 'string' ? productRaw : productRaw != null ? String(productRaw) : '',
    )
    if (!productName) continue
    const quantityValue = row?.[quantityKey]
    const quantityText = coerceQuantity(quantityValue)
    const units = parseUnitsFromValue(quantityValue) ?? parseUnitsFromValue(quantityText)

    const item: VisionOrderItem = {
      id: buildVisionOrderItemId(productName, index),
      productName,
      quantityText,
      units: units ?? undefined,
      cantidad: units ?? undefined,
      client: '',
      labelType: deriveLabelTypeFromClient(),
      include: true,
    }

    items.push(item)
  }

  const clientValue = clientKey ? records[0]?.[clientKey] : null
  const client =
    typeof clientValue === 'string'
      ? clientValue
      : typeof clientValue === 'number'
      ? String(clientValue)
      : ''

  return { items, client }
}

function parseCsvOrTsv(buffer: Buffer, delimiter: ',' | '\t'): SpreadsheetRecord[] {
  const text = buffer.toString('utf8')
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && (char === delimiter || char === '\n' || char === '\r')) {
      if (char === delimiter) {
        row.push(current)
        current = ''
        continue
      }
      if (char === '\r' && text[i + 1] === '\n') {
        i++
      }
      row.push(current)
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row)
      }
      row = []
      current = ''
      continue
    }
    current += char
  }
  row.push(current)
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row)
  }

  if (rows.length === 0) return []
  const [headerRow, ...dataRows] = rows
  const headers = headerRow.map((cell, index) => cell.trim() || `col_${index + 1}`)

  return dataRows.map((dataRow) => {
    const record: SpreadsheetRecord = {}
    headers.forEach((header, index) => {
      record[header] = dataRow[index] ?? ''
    })
    return record
  })
}

function parseSpreadsheet(buffer: Buffer, fileName: string, mimeType: string): VisionOrderParseResult | null {
  const lower = fileName.toLowerCase()
  const mimeLower = mimeType.toLowerCase()
  const isTsv = lower.endsWith('.tsv') || mimeLower.includes('tsv')
  const isCsv = lower.endsWith('.csv') || mimeLower.includes('csv')
  const isExcel = /\.(xlsx|xls|xlsm|ods)$/.test(lower) || mimeLower.includes('spreadsheet') || mimeLower.includes('excel')

  let records: SpreadsheetRecord[] = []
  if (isCsv || isTsv) {
    records = parseCsvOrTsv(buffer, isTsv ? '\t' : ',')
  } else if (isExcel) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const [firstSheetName] = workbook.SheetNames
      const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null
      if (firstSheet) {
        records = XLSX.utils.sheet_to_json<SpreadsheetRecord>(firstSheet, { defval: '' })
      }
    } catch (error) {
      console.error('[vision-order-parser] Error leyendo hoja de cálculo', error)
      return null
    }
  } else {
    return null
  }

  const headers = Object.keys(records[0] ?? {})
  const rows = headers.length > 0 ? records.map((record) => headers.map((header) => String(record[header] ?? ''))) : []
  const table: VisionOrderTable | null = headers.length > 0 ? { headers, rows } : null

  const { items, client } = buildItemsFromRecords(records)
  if (items.length === 0 && !table) return null

  const resolvedClient = client || 'mercadona'
  return {
    client: resolvedClient,
    items: items.map((item, index) => ({
      ...item,
      client: resolvedClient,
      labelType: deriveLabelTypeFromClient(resolvedClient),
      id: buildVisionOrderItemId(item.productName, index),
    })),
    rawText: 'Pedido procesado desde hoja de cálculo.',
    notes: 'Datos obtenidos directamente del archivo Excel/CSV.',
    table,
  }
}

export async function parseVisionOrderFromFile(buffer: Buffer, mimeType: string, fileName: string): Promise<VisionOrderParseResult> {
  try {
    const spreadsheetResult = parseSpreadsheet(buffer, fileName, mimeType)
    if (spreadsheetResult) {
      return spreadsheetResult
    }

    const parsed = await callOpenAiVision({ buffer, mimeType, fileName })
    const items = buildItems(parsed.items)
    const client = parsed.client ?? ''
    return {
      client,
      items: items.map((item, index) => ({
        ...item,
        client,
        labelType: deriveLabelTypeFromClient(client || item.client),
        id: buildVisionOrderItemId(item.productName, index),
      })),
      rawText: parsed.rawText ?? '',
      notes: 'Datos generados automáticamente por visión',
    }
  } catch (error) {
    console.error('[vision-order-parser] Vision failed, returning fallback data', error)
    return {
      client: 'mercadona',
      items: [
        {
          id: 'fallback-1',
          productName: 'Producto ejemplo',
          quantityText: '1 ud',
          client: 'mercadona',
          labelType: deriveLabelTypeFromClient('mercadona'),
          include: true,
        },
      ],
      rawText: 'No se pudo leer el pedido automáticamente.',
      notes: 'Respuesta de respaldo por fallo en la API de visión.',
    }
  }
}
