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
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
      },
    })
  } catch (error) {
    console.error('[pedidos-subidos/file] error', error)
    return NextResponse.json({ error: 'No se pudo recuperar el archivo.' }, { status: 500 })
  }
}
