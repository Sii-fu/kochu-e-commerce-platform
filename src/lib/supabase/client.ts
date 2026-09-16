import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.',
  )
}

/**
 * The only Supabase client in the app.
 *
 * The anon key it carries is public by design -- it ships inside the JS bundle
 * and anyone can read it. Nothing here may rely on it being secret: every
 * guarantee lives in RLS and in the authorization checks inside the
 * SECURITY DEFINER functions in supabase/migrations/0006_functions.sql.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
