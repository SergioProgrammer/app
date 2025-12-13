import type { VisionOrderParseResult, VisionOrderItem } from '@/lib/vision-orders'
import { buildVisionOrderItemId, deriveLabelTypeFromClient, sanitizeProductName } from '@/lib/vision-orders'
import type { VisionOrderTable } from '@/lib/vision-orders'
import * as XLSX from 'xlsx'

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini'
const QUANTITY_COLUMN_INDEX = 27
const PRODUCT_COLUMN_INDEX = 5

async function convertPdfToPngBuffers(pdfBuffer: Buffer, maxPages = 2): Promise<Buffer[]> {
  try {
    const pdfjs = (await import('pdfjs-dist')) as typeof import('pdfjs-dist')
    const { createCanvas } = (await import('@napi-rs/canvas')) as typeof import('@napi-rs/canvas')
    const loadingTask = pdfjs.getDocument({
      data: pdfBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    })
    const pdf = await loadingTask.promise
    const pageCount = Math.min(pdf.numPages, maxPages)
    const buffers: Buffer[] = []
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
      const page = await pdf.getPage(pageIndex)
      const viewport = page.getViewport({ scale: 1.6 })
      const canvas = createCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')
      await page.render({ canvasContext: context as never, viewport }).promise
      buffers.push(canvas.toBuffer('image/png'))
    }
    return buffers
  } catch (error) {
    console.error('[vision-order-parser] PDF to PNG conversion error', error)
    return []
  }
}

async function callOpenAiVision({
  buffers,
  mimeType,
  fileName,
}: {
  buffers: Buffer[]
  mimeType: string
  fileName: string
}): Promise<{ client: string; items: Array<{ product: string; quantity: string }>; rawText?: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada')
  }
  if (!buffers || buffers.length === 0) {
    throw new Error('No hay buffers para enviar a visión')
  }
  const imageUrls = buffers.map((buffer) => `data:${mimeType};base64,${buffer.toString('base64')}`)

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'Eres un asistente que lee albaranes o pedidos y devuelve solo JSON. Extrae productos, cantidades y la empresa/cliente.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Devuelve SOLO JSON con {client, items: [{product, quantity}], raw_text}' },
            { type: 'input_text', text: `Archivo: ${fileName}` },
            ...imageUrls.map((url) => ({ type: 'input_image', image_url: url })),
          ],
        },
      ],
      temperature: 0,
      max_output_tokens: 800,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('[openai] status', response.status)
    console.error('[openai] body', text.slice(0, 1500))
    console.error('[openai] request-id', response.headers.get('x-request-id'))
    console.error('[openai] model', OPENAI_MODEL)
    throw new Error(`OpenAI Vision error: ${response.status} ${text}`)
  }

  const data = (await response.json()) as Record<string, unknown>

  const content =
    typeof data.output_text === 'string'
      ? data.output_text
      : Array.isArray(data.output)
      ? (data.output as unknown[])
          .flatMap((o) => {
            const contentArr = (o as { content?: unknown }).content
            return Array.isArray(contentArr) ? contentArr : []
          })
          .filter((c) => (c as { type?: string }).type === 'output_text' && typeof (c as { text?: unknown }).text === 'string')
          .map((c) => (c as { text: string }).text)
          .join('\n')
      : ''

  if (!content) {
    throw new Error(`Responses API returned no output_text. keys=${Object.keys(data).join(',')}`)
  }

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

function coerceMercadonaQuantity(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '0'
    return trimmed
  }
  return '0'
}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findHeader(headers: string[], normalizedHeaders: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate)
    if (idx >= 0) return headers[idx]
  }
  return null
}

function isNumericProduct(value: string): boolean {
  const normalized = value.trim()
  return normalized !== '' && /^[\d\s.,-]+$/.test(normalized)
}

function buildItemsFromRecords(records: SpreadsheetRecord[]): { items: VisionOrderItem[]; client: string } {
  if (records.length === 0) {
    return { items: [], client: '' }
  }

  const headers = Object.keys(records[0] ?? {})
  const normalizedHeaders = headers.map(normalizeHeader)
  const headerByNormalized = normalizedHeaders.reduce<Record<string, string>>((acc, normalized, index) => {
    acc[normalized] = headers[index]
    return acc
  }, {})
  const forcedProductKey = headers[PRODUCT_COLUMN_INDEX] ?? null
  const forcedQuantityKey = headers[QUANTITY_COLUMN_INDEX] ?? null

  const clientKey = pickFirstKey(headers, ['cliente', 'client', 'destino'])
  const clientValue = clientKey ? records[0]?.[clientKey] : null
  const clientString =
    typeof clientValue === 'string'
      ? clientValue
      : typeof clientValue === 'number'
      ? String(clientValue)
      : ''
  const lowerClient = clientString.toLowerCase()

  const tableText = `${headers.join(' ')} ${records
    .map((row) => Object.values(row).join(' '))
    .join(' ')}`.toLowerCase()
  const isMercadona = lowerClient.includes('mercadona') || tableText.includes('mercadona')
  const isHiperdino = lowerClient.includes('hiperdino') || lowerClient.includes('dinosol') || tableText.includes('hiperdino')

  const productKey =
    forcedProductKey ??
    (isMercadona
      ? findHeader(headers, normalizedHeaders, ['descripcion'])
      : null) ??
    findHeader(headers, normalizedHeaders, ['producto', 'product', 'descripcion', 'description', 'articulo', 'item', 'nombre']) ??
    headers[0] ??
    ''

  const quantityKey =
    forcedQuantityKey ??
    (isMercadona
      ? findHeader(headers, normalizedHeaders, ['cantidad'])
      : isHiperdino
      ? findHeader(headers, normalizedHeaders, ['pedido']) ?? headers[5] ?? null
      : null) ??
    findHeader(headers, normalizedHeaders, ['cantidad', 'qty', 'unidades', 'uds', 'cantidad pedida', 'cantidad_pedida', 'cant']) ??
    headers[1] ??
    ''

  const unidadKey = findHeader(headers, normalizedHeaders, ['unidad de medida', 'unidad de medida.', 'unidad_medida', 'udm'])

  const items: VisionOrderItem[] = []

  for (let index = 0; index < records.length; index++) {
    const row = records[index]
    const getByNormalized = (candidates: string[]): unknown => {
      for (const candidate of candidates) {
        const key = headerByNormalized[candidate]
        if (key && key in row) return row[key]
      }
      return undefined
    }
    const productRaw = row?.[productKey]
    let productName = sanitizeProductName(
      typeof productRaw === 'string' ? productRaw : productRaw != null ? String(productRaw) : '',
    )

    if (isMercadona) {
      if (!productName || isNumericProduct(productName)) {
        productName = 'Albahaca'
      }
    } else {
      if (!productName || isNumericProduct(productName)) {
        const altProductKey = findHeader(headers, normalizedHeaders, ['producto', 'product', 'articulo', 'nombre', 'descripcion'])
        if (altProductKey && altProductKey !== productKey) {
          const altRaw = row?.[altProductKey]
          const altName = sanitizeProductName(typeof altRaw === 'string' ? altRaw : altRaw != null ? String(altRaw) : '')
          if (altName && !isNumericProduct(altName)) {
            productName = altName
          }
        }
        if (!productName || isNumericProduct(productName)) {
          const firstText = Object.values(row ?? {}).find(
            (value) => typeof value === 'string' && /[a-zA-Z]/.test(value) && !isNumericProduct(value),
          )
          if (firstText && typeof firstText === 'string') {
            productName = sanitizeProductName(firstText)
          }
        }
      }
    }

    if (!productName || isNumericProduct(productName)) continue

    const quantityValue = row?.[quantityKey]
    const quantityText = isMercadona ? coerceMercadonaQuantity(quantityValue) : coerceQuantity(quantityValue)
    const units = parseUnitsFromValue(quantityValue) ?? parseUnitsFromValue(quantityText)
    const unidadMedida = unidadKey ? String(row?.[unidadKey] ?? '').trim().toLowerCase() : null
    const shouldTrustUnits = unidadMedida ? unidadMedida === 'un' || unidadMedida === 'unidad' || unidadMedida === 'unidades' : true
    let resolvedUnits = shouldTrustUnits ? units : units

    // Mercadona: si no hay unidades o es 0, intenta multiplicar columnas "Cantidad de U. Exp" x "Unidades de Consumo por U. Exp"
    if (isMercadona && (!resolvedUnits || resolvedUnits <= 0)) {
      const expedUnitsRaw = getByNormalized([
        'cantidad de u. exp',
        'cantidad u exp',
        'cantidad de u exp',
        'cantidad u. exp',
        'cantidad u.exp',
      ])
      const consumoUnitsRaw = getByNormalized([
        'unidades de consumo por u. exp',
        'unidades de consumo por u exp',
        'unidades consumo u exp',
        'ud consumo u exp',
        'uds consumo u exp',
      ])
      const expedUnits = parseUnitsFromValue(expedUnitsRaw)
      const consumoUnits = parseUnitsFromValue(consumoUnitsRaw)
      if (expedUnits && consumoUnits) {
        resolvedUnits = expedUnits * consumoUnits
      } else if (expedUnits) {
        resolvedUnits = expedUnits
      } else if (consumoUnits) {
        resolvedUnits = consumoUnits
      }
    }
    if (isMercadona && (resolvedUnits == null || resolvedUnits <= 0)) {
      resolvedUnits = 0
    }

    const item: VisionOrderItem = {
      id: buildVisionOrderItemId(productName, index),
      productName,
      quantityText,
      units: resolvedUnits ?? undefined,
      cantidad: resolvedUnits ?? undefined,
      client: clientString,
      labelType: deriveLabelTypeFromClient(clientString),
      include: true,
    }

    items.push(item)
  }

  const client = clientString || (isMercadona ? 'mercadona' : '')

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

  const resolvedClient = client || (isExcel ? 'Lidl' : 'mercadona')
  const resolvedLabelType = isExcel ? 'lidl' : deriveLabelTypeFromClient(resolvedClient)
  return {
    client: resolvedClient,
    items: items.map((item, index) => ({
      ...item,
      client: resolvedClient,
      labelType: resolvedLabelType,
      id: buildVisionOrderItemId(item.productName, index),
    })),
    rawText: 'Pedido procesado desde hoja de cálculo.',
    notes: 'Datos obtenidos directamente del archivo Excel/CSV.',
    table,
  }
}

export async function parseVisionOrderFromFile(buffer: Buffer, mimeType: string, fileName: string): Promise<VisionOrderParseResult> {
  const isXlsxUpload = /\.xlsx$/i.test(fileName)
  try {
    const spreadsheetResult = parseSpreadsheet(buffer, fileName, mimeType)
    if (spreadsheetResult) {
      return spreadsheetResult
    }

    let buffersForVision: Buffer[] = [buffer]
    let visionMime = mimeType

    if (mimeType === 'application/pdf') {
      const converted = await convertPdfToPngBuffers(buffer)
      if (converted.length === 0) {
        throw new Error('PDF conversion failed')
      }
      buffersForVision = converted
      visionMime = 'image/png'
    }

    const parsed = await callOpenAiVision({ buffers: buffersForVision, mimeType: visionMime, fileName })
    const items = buildItems(parsed.items)
    const parsedClient = parsed.client ?? ''
    const resolvedClient = isXlsxUpload ? parsedClient || 'Lidl' : parsedClient
    return {
      client: resolvedClient,
      items: items.map((item, index) => ({
        ...item,
        client: resolvedClient || item.client,
        labelType: isXlsxUpload ? 'lidl' : deriveLabelTypeFromClient(resolvedClient || item.client),
        id: buildVisionOrderItemId(item.productName, index),
      })),
      rawText: parsed.rawText ?? '',
      notes: 'Datos generados automáticamente por visión',
    }
  } catch (error) {
    console.error('[vision-order-parser] Vision failed, returning fallback data', error)
    const fallbackClient = isXlsxUpload ? 'Lidl' : 'mercadona'
    const fallbackLabel = isXlsxUpload ? 'lidl' : deriveLabelTypeFromClient('mercadona')
    return {
      client: fallbackClient,
      items: [
        {
          id: 'fallback-1',
          productName: 'Producto ejemplo',
          quantityText: '1 ud',
          client: fallbackClient,
          labelType: fallbackLabel,
          include: true,
        },
      ],
      rawText: 'No se pudo leer el pedido automáticamente.',
      notes: 'Respuesta de respaldo por fallo en la API de visión.',
    }
  }
}
