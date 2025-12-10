import { NextResponse, type NextRequest } from 'next/server'
import { adjustInventory, listInventory } from '@/server/inventory'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const items = await listInventory()
    return NextResponse.json({ items })
  } catch (error) {
    console.error('[api/stock] GET error', error)
    return NextResponse.json({ error: 'No se pudo obtener el inventario.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const productName = typeof body.productName === 'string' ? body.productName.trim() : ''
    const delta = typeof body.delta === 'number' ? body.delta : undefined
    const setTo = typeof body.setTo === 'number' ? body.setTo : undefined
    if (!productName) {
      return NextResponse.json({ error: 'Falta el nombre del producto.' }, { status: 400 })
    }
    if (delta === undefined && setTo === undefined) {
      return NextResponse.json({ error: 'Indica delta o setTo para ajustar stock.' }, { status: 400 })
    }

    const record = await adjustInventory({ productName, delta, setTo })
    if (!record) {
      return NextResponse.json({ error: 'No se pudo ajustar el inventario.' }, { status: 500 })
    }
    return NextResponse.json({ item: record })
  } catch (error) {
    console.error('[api/stock] POST error', error)
    return NextResponse.json({ error: 'No se pudo ajustar el inventario.' }, { status: 500 })
  }
}
