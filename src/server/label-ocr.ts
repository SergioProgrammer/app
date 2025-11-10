import { google, type vision_v1 } from 'googleapis'

interface VisionCredentials {
  client_email: string
  private_key: string
}

let cachedClient: vision_v1.Vision | null = null

function loadCredentials(): VisionCredentials | null {
  const json =
    process.env.GOOGLE_VISION_CREDENTIALS_JSON ??
    (process.env.GOOGLE_VISION_CREDENTIALS_B64
      ? Buffer.from(process.env.GOOGLE_VISION_CREDENTIALS_B64, 'base64').toString('utf8')
      : null)

  if (!json) {
    return null
  }

  try {
    const parsed = JSON.parse(json) as VisionCredentials
    if (parsed.client_email && parsed.private_key) {
      return parsed
    }
  } catch {
    // ignore invalid json
  }
  return null
}

async function getVisionClient(): Promise<vision_v1.Vision | null> {
  if (cachedClient) return cachedClient
  const credentials = loadCredentials()
  if (!credentials) return null

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/cloud-vision'],
  })

  cachedClient = google.vision({ version: 'v1', auth })
  return cachedClient
}

export async function extractFechaCargaFromImage(buffer: Buffer): Promise<string | null> {
  const client = await getVisionClient()
  if (!client) return null

  try {
    const response = await client.images.annotate({
      requestBody: {
        requests: [
          {
            image: { content: buffer.toString('base64') },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      },
    })

    const annotation =
      response.data.responses?.[0]?.fullTextAnnotation?.text ??
      response.data.responses?.[0]?.textAnnotations?.[0]?.description ??
      ''

    return parseFechaCarga(annotation)
  } catch (error) {
    console.error('[label-ocr] Vision request failed:', error)
    return null
  }
}

function parseFechaCarga(rawText: string): string | null {
  if (!rawText || rawText.trim().length === 0) return null

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const prioritized: string[] = []
  const secondary: string[] = []

  for (const line of lines) {
    const dates = extractDateCandidates(line)
    if (dates.length === 0) continue
    if (/carga|envas/i.test(line)) {
      prioritized.push(...dates)
    } else {
      secondary.push(...dates)
    }
  }

  const candidates = [...prioritized, ...secondary]
  for (const candidate of candidates) {
    const iso = normalizeToIso(candidate)
    if (iso) return iso
  }

  return null
}

function extractDateCandidates(text: string): string[] {
  const matches = text.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g)
  return matches ?? []
}

function normalizeToIso(dateText: string): string | null {
  const match = dateText.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (!match) return null
  const [, dayStr, monthStr, yearStr] = match
  const day = Number.parseInt(dayStr, 10)
  const month = Number.parseInt(monthStr, 10)
  let year = Number.parseInt(yearStr, 10)

  if (yearStr.length === 2) {
    year += year >= 70 ? 1900 : 2000
  }

  if (!isValidDate(year, month, day)) return null

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}
