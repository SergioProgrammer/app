import { NextResponse, type NextRequest } from 'next/server'
import { processLabelAutomation } from '@/server/label-automation'
import { deriveLabelTypeFromClient, sanitizeProductName, type VisionOrderItem } from '@/lib/vision-orders'
import type { ManualLabelFields } from '@/server/label-automation'
import { uploadFileToBucket, type StorageFileDescriptor } from '@/server/supabase-storage'

export const runtime = 'nodejs'

interface GeneratePayload {
  items: VisionOrderItem[]
}

const ETIQUETAS_BUCKET = process.env.SUPABASE_ETIQUETAS_BUCKET ?? 'etiquetas_final'
const DEFAULT_VISION_FOLDER =
  process.env.SUPABASE_ALBARANES_FOLDER ??
  process.env.GOOGLE_DRIVE_FOLDER_ID ??
  'vision'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GeneratePayload
    const items = Array.isArray(body.items) ? body.items.filter((item) => item?.include !== false) : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'No se recibieron productos para procesar.' }, { status: 400 })
    }

    const folderPath = normalizeFolder(DEFAULT_VISION_FOLDER)
    const uploadedFiles: StorageFileDescriptor[] = []
    const results = []
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const labelType = deriveLabelTypeFromClient(item.client) ?? item.labelType
      const manualFields: ManualLabelFields = {
        labelType,
        productName: sanitizeProductName(item.productName),
        weight: item.quantityText,
      }
      const fileName = buildFileNameFromItem(item, index)
      const automation = await processLabelAutomation({
        fileName,
        manualFields,
      })
      // Guardamos los archivos de etiqueta en Supabase Storage para que aparezcan en el dashboard.
      if (Array.isArray(automation.labels)) {
        for (const label of automation.labels) {
          if (!label?.buffer || !label.fileName) continue
          const targetBucket = label.storageBucket ?? ETIQUETAS_BUCKET
          const targetPath = buildStoragePath(folderPath, label.fileName)
          const descriptor = await uploadFileToBucket({
            bucket: targetBucket,
            path: targetPath,
            buffer: label.buffer,
            contentType: label.mimeType,
            metadata: {
              description: JSON.stringify({
                generatedFrom: 'vision-orders',
                productName: manualFields.productName,
                labelType,
              }),
            },
          })
          uploadedFiles.push(descriptor)
        }
      }

      results.push({
        productName: manualFields.productName,
        labelType,
        labels: automation.labels.map((label) => ({
          fileName: label.fileName,
          mimeType: label.mimeType,
          storageBucket: label.storageBucket ?? null,
        })),
      })
    }

    return NextResponse.json({ data: results, files: uploadedFiles })
  } catch (error) {
    console.error('[api/vision-orders/generate] error', error)
    return NextResponse.json(
      { error: 'No se pudieron generar las etiquetas automáticamente.' },
      { status: 500 },
    )
  }
}

function buildFileNameFromItem(item: VisionOrderItem, index: number): string {
  const slug = item.productName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const base = slug || 'pedido-vision'
  return `${base}-${index + 1}.pdf`
}

function normalizeFolder(folder: string | null | undefined): string {
  if (!folder) return 'vision'
  return folder.trim().replace(/^\/+/, '').replace(/\/+$/, '') || 'vision'
}

function buildStoragePath(folder: string | null, fileName: string): string {
  const normalizedFolder = folder ? folder.replace(/^\/+|\/+$/g, '') : ''
  const normalizedFileName = fileName.replace(/^\/+/, '')
  return normalizedFolder ? `${normalizedFolder}/${normalizedFileName}` : normalizedFileName
}
