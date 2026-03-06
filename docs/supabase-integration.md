# Supabase Integration

## Client Initialization

### Client-side (browser)

Uses the anon key (safe to expose):

```typescript
import { createClient } from '@/utils/supabase/client'
const supabase = createClient()
```

### Server-side (API routes, server components)

Uses the service role key (bypasses RLS):

```typescript
import { createClient as createServiceClient } from '@supabase/supabase-js'
const supabase = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Important**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code.

## File Upload Flow

```
User uploads file
  -> FormData sent to API route
  -> File read as Buffer/ArrayBuffer
  -> Process (parse/generate labels)
  -> Upload to Supabase Storage via uploadFileToBucket()
  -> Return signed URL
```

## Real-time Subscriptions

The dashboard uses Supabase real-time subscriptions for live updates:

```typescript
const channel = supabase
  .channel('pedidos_subidos_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_subidos' }, () => {
    // Refetch data
  })
  .subscribe()
```

## Security

- **CAPTCHA**: Cloudflare Turnstile on login page (`/api/turnstile`)
- **Service Role Key**: Server-side only, never in client bundles
- **File Validation**: MIME type checks on uploads
- **Row-Level Security (RLS)**: Configured in Supabase, all operations filtered by `auth.uid() = user_id`
- **Invoice generation**: Uses server Supabase client to bypass RLS on `facturas` table from API routes
