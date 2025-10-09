import { NextResponse } from 'next/server'

type LabelsWebhookPayload = {
  storagePath: string
  fileName: string
  publicUrl?: string | null
  userEmail?: string | null
  destination?: string | null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LabelsWebhookPayload>
    const storagePath = body.storagePath?.trim()
    const fileName = body.fileName?.trim()
    const destination = body.destination?.trim() ?? null
    const publicUrl = body.publicUrl ?? null
    const userEmail = body.userEmail ?? null

    if (!storagePath || !fileName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faltan parámetros obligatorios para notificar a n8n.',
        },
        { status: 400 },
      )
    }

    const webhookUrl =
      process.env.N8N_LABELS_WEBHOOK_URL ??
      (process.env.N8N_URL ? `${process.env.N8N_URL}/webhook/labels` : null)

    if (!webhookUrl) {
      console.warn(
        '[n8n-labels] N8N_LABELS_WEBHOOK_URL o N8N_URL no están configurados. Se omite la notificación.',
      )
      return NextResponse.json({
        success: true,
        skipped: true,
        message:
          'Webhook de n8n no configurado. El PDF se guardó correctamente, pero no se notificó a n8n.',
      })
    }

    const webhookBody = {
      storagePath,
      fileName,
      publicUrl,
      userEmail,
      destination,
    }

    const headers = new Headers({
      'Content-Type': 'application/json',
    })

    const webhookKey = process.env.N8N_LABELS_WEBHOOK_KEY ?? process.env.N8N_API_KEY
    if (webhookKey) {
      headers.set('X-N8N-API-KEY', webhookKey)
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhookBody),
    })

    const text = await response.text()
    if (!response.ok) {
      console.error('[n8n-labels] Error en la respuesta de n8n:', text)
      return NextResponse.json(
        {
          success: false,
          error: text || 'n8n devolvió un error al procesar la etiqueta.',
        },
        { status: 502 },
      )
    }

    console.log('[n8n-labels] Webhook enviado correctamente a n8n:', {
      webhookUrl,
      storagePath,
      destination,
      userEmail,
    })

    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }

    return NextResponse.json({
      success: true,
      webhook: Array.isArray(parsed) || (parsed && typeof parsed === 'object') ? parsed : text,
    })
  } catch (error) {
    console.error('[n8n-labels] Error notificando a n8n:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido notificando a n8n.',
      },
      { status: 500 },
    )
  }
}
