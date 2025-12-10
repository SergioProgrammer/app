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
    const body =
      buffer instanceof ArrayBuffer
        ? buffer
        : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    return new NextResponse(body, {
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
