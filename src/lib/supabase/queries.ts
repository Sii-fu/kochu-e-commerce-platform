import { supabase } from './client'

/**
 * Typed read helpers, grouped by feature as the catalog grows. Nothing here
 * writes -- writes to money/stock tables go through src/lib/supabase/rpc.ts,
 * and everything else goes through a plain `.insert()`/`.update()` call at
 * its call site, gated by RLS.
 */

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function getAddresses(userId: string) {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
