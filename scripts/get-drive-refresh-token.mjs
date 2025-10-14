#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { google } from 'googleapis'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { config as loadEnv } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

loadEnv({ path: path.join(__dirname, '..', '.env.local') })
loadEnv({ path: path.join(__dirname, '..', '.env') })

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI

if (!clientId || !clientSecret || !redirectUri) {
  console.error(
    'Configura GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET y GOOGLE_DRIVE_REDIRECT_URI antes de ejecutar este script.',
  )
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
const scopes = ['https://www.googleapis.com/auth/drive.file']

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: scopes,
})

console.log('1. Abre la siguiente URL en tu navegador:')
console.log(authUrl)
console.log('\n2. Completa el consentimiento y copia el código que te muestre Google.')

const rl = readline.createInterface({ input, output })
const code = (await rl.question('\n3. Pega aquí el código: ')).trim()
rl.close()

if (!code) {
  console.error('No se proporcionó ningún código de autorización.')
  process.exit(1)
}

try {
  const { tokens } = await oauth2Client.getToken(code)
  if (!tokens.refresh_token) {
    console.warn(
      'No recibimos refresh_token. Asegúrate de usar "prompt=consent" y que el cliente esté marcado como escritorio o web.',
    )
  }
  console.log('\nTokens obtenidos correctamente.')
  if (tokens.refresh_token) {
    console.log('GUARDA ESTE REFRESH TOKEN EN .env.local (GOOGLE_DRIVE_REFRESH_TOKEN):')
    console.log(tokens.refresh_token)
  } else {
    console.log(tokens)
  }
} catch (error) {
  console.error('No se pudo intercambiar el código por tokens.')
  console.error(error)
  process.exit(1)
}
