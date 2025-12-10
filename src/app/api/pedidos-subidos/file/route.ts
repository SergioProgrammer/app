import { NextResponse, type NextRequest } from 'next/server'
import { downloadFileFromBucket } from '@/server/supabase-storage'
import path from 'node:path'

export const runtime = 'nodejs'

const PEDIDOS_BUCKET = process.env.SUPABASE_PEDIDOS_BUCKET ?? 'pedidos_subidos'

export async function GET(request: NextRequest) {
  try {
    const filePath = request.nextUrl.searchParams.get('path')
    if (!filePath) {
      return NextResponse.json({ error: 'Falta el path del archivo.' }, { status: 400 })
    }
    const { buffer, contentType } = await downloadFileFromBucket(PEDIDOS_BUCKET, filePath)

    // Aseguramos un tipo binario único aceptado por BodyInit.
    const binary: Uint8Array =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBufferLike)

    return new NextResponse(binary as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
      },
    })
  } catch (error) {
    console.error('[pedidos-subidos/file] error', error)
    return NextResponse.json({ error: 'No se pudo recuperar el archivo.' }, { status: 500 })
  }
}
