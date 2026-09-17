import { supabase } from './client'
import type { AddressInput, ProfileInput } from '@/lib/validation/auth'

/**
 * Plain writes to tables that are not money/stock -- RLS (`profiles_update_self`,
 * `addresses_*_own` in 0007_rls.sql) is the actual gate here, not this file.
 */

export async function updateProfile(userId: string, input: ProfileInput) {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: input.fullName, phone: input.phone || null })
    .eq('id', userId)

  if (error) throw error
}

// `addresses_one_default_per_user` (0004_commerce.sql) is a unique index on
// (user_id) WHERE is_default -- at most one default row per user at the
// database level. Setting a new default has to clear the old one first, or
// the insert/update hits that constraint. Two sequential statements, not one
// transaction: this is a convenience table, not money or stock, so a rare
// interruption between them (leaving nobody marked default) is an acceptable
// failure mode -- the constraint still makes "two defaults" impossible.
async function clearExistingDefault(userId: string) {
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true)

  if (error) throw error
}

export async function createAddress(userId: string, input: AddressInput) {
  if (input.isDefault) await clearExistingDefault(userId)

  const { error } = await supabase.from('addresses').insert({
    user_id: userId,
    label: input.label || null,
    recipient: input.recipient,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2 || null,
    city: input.city,
    district: input.district || null,
    postal_code: input.postalCode || null,
    is_default: input.isDefault,
  })

  if (error) throw error
}

export async function updateAddress(id: string, userId: string, input: AddressInput) {
  if (input.isDefault) await clearExistingDefault(userId)

  const { error } = await supabase
    .from('addresses')
    .update({
      label: input.label || null,
      recipient: input.recipient,
      phone: input.phone,
      line1: input.line1,
      line2: input.line2 || null,
      city: input.city,
      district: input.district || null,
      postal_code: input.postalCode || null,
      is_default: input.isDefault,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteAddress(id: string) {
  const { error } = await supabase.from('addresses').delete().eq('id', id)
  if (error) throw error
}

/** Public signup -- early_access_insert_public in 0007_rls.sql allows this
 * for anon and authenticated alike. unique(email) handles a repeat signup. */
export async function joinEarlyAccess(email: string, dropId?: string) {
  const { error } = await supabase
    .from('early_access')
    .insert({ email, drop_id: dropId ?? null, source: 'early-access-page' })

  if (error) {
    // 23505 = unique_violation on email. Not a real failure from the
    // visitor's point of view -- they're already on the list.
    if (error.code === '23505') return
    throw error
  }
}
