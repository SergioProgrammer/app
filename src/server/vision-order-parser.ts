import type { VisionOrderParseResult, VisionOrderItem } from '@/lib/vision-orders'
import { buildVisionOrderItemId, deriveLabelTypeFromClient, sanitizeProductName } from '@/lib/vision-orders'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini'

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

export async function parseVisionOrderFromFile(buffer: Buffer, mimeType: string, fileName: string): Promise<VisionOrderParseResult> {
  try {
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
