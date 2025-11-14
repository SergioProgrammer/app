import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing URL or service key')
  process.exit(1)
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const bucket = process.argv[2] ?? 'albaranes_finales'
const folder = process.argv[3] ?? ''

const { data, error } = await client.storage.from(bucket).list(folder, {
  limit: 20,
  offset: 0,
})

if (error) {
  console.error('List error', error)
  process.exit(1)
}

for (const entry of data ?? []) {
  console.log('entry', JSON.stringify(entry, null, 2))
}
