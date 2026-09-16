import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.',
  )
}

/**
 * The only Supabase client in the app.
 *
 * The publishable key it carries is public by design -- it ships inside the JS
 * bundle and anyone can read it. Nothing here may rely on it being secret:
 * every guarantee lives in RLS and in the authorization checks inside the
 * SECURITY DEFINER functions in supabase/migrations/0006_functions.sql.
 *
 * `sb_publishable_…` is Supabase's replacement for the legacy `anon` JWT. It
 * resolves to the same `anon` Postgres role, so every policy and grant written
 * against `anon` applies to it unchanged.
 */
export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
