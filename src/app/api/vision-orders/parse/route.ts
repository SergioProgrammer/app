import { NextResponse, type NextRequest } from 'next/server'
import { parseVisionOrderFromFile } from '@/server/vision-order-parser'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo del pedido.' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType =
      file.type ||
      (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
    const result = await parseVisionOrderFromFile(buffer, mimeType, file.name)
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[api/vision-orders/parse] error', error)
    return NextResponse.json(
      { error: 'No se pudo leer el pedido. Intenta de nuevo o carga los datos manualmente.' },
      { status: 500 },
    )
  }
}
