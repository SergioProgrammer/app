import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { CookieOptions } from '@supabase/ssr'

export const createServerClient = () => {
  const cookieStore = cookies() 

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options)
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, "", options)
          } catch {}
        },
      },
    }
  )
}
