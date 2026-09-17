import { supabase } from './client'
import type { Database } from './types'

/**
 * Typed wrappers for every SECURITY DEFINER function in
 * supabase/migrations/0006_functions.sql. This file exists so a call site
 * never spells out the RPC name or its jsonb payload shape by hand -- the
 * function itself is the security boundary, not this wrapper.
 */

type CreateOrderPayload = Database['public']['Functions']['create_order']['Args']['payload']

export async function createOrder(payload: CreateOrderPayload) {
  const { data, error } = await supabase.rpc('create_order', { payload })
  if (error) throw error
  return data as {
    order_id: string
    guest_token: string
    order_number: string
    total_minor: number
    replayed: boolean
  }
}

export async function validateDiscount(code: string, subtotalMinor: number) {
  const { data, error } = await supabase.rpc('validate_discount', {
    p_code: code,
    p_subtotal_minor: subtotalMinor,
  })
  if (error) throw error
  return data as {
    valid: boolean
    message?: string
    code?: string
    type?: 'PERCENT' | 'FIXED'
    value?: number
    discount_minor?: number
    min_order_minor?: number
  }
}

export async function getOrderByToken(orderId: string, token: string) {
  const { data, error } = await supabase.rpc('get_order_by_token', {
    p_order_id: orderId,
    p_token: token,
  })
  if (error) throw error
  return data
}

export async function submitMfsTransaction(args: {
  orderId: string
  token: string
  provider: 'BKASH' | 'NAGAD'
  trxId: string
  senderMsisdn: string
  receiptPath?: string | null
}) {
  const { data, error } = await supabase.rpc('submit_mfs_transaction', {
    p_order_id: args.orderId,
    p_token: args.token,
    p_provider: args.provider,
    p_trx_id: args.trxId,
    p_msisdn: args.senderMsisdn,
    p_receipt_path: args.receiptPath ?? undefined,
  })
  if (error) throw error
  return data as { transaction_id: string; payment_status: string }
}

export async function verifyMfsTransaction(txId: string, approve: boolean, note?: string) {
  const { data, error } = await supabase.rpc('verify_mfs_transaction', {
    p_tx_id: txId,
    p_approve: approve,
    p_note: note,
  })
  if (error) throw error
  return data as { transaction_id: string; approved: boolean }
}

export async function adminUpdateOrderStatus(args: {
  orderId: string
  next: Database['public']['Enums']['order_status']
  note?: string
  trackingCode?: string
  courier?: string
}) {
  const { data, error } = await supabase.rpc('admin_update_order_status', {
    p_order_id: args.orderId,
    p_next: args.next,
    p_note: args.note,
    p_tracking_code: args.trackingCode,
    p_courier: args.courier,
  })
  if (error) throw error
  return data as { order_id: string; status: string }
}

export async function shippingFor(subtotalMinor: number) {
  const { data, error } = await supabase.rpc('shipping_for', { p_subtotal_minor: subtotalMinor })
  if (error) throw error
  return data
}

export async function grantDropAccess(dropId: string, emails: string[]) {
  const { data, error } = await supabase.rpc('grant_drop_access', {
    p_drop_id: dropId,
    p_emails: emails,
  })
  if (error) throw error
  return data
}

export async function redeemDropKey(dropId: string, key: string) {
  const { data, error } = await supabase.rpc('redeem_drop_key', {
    p_drop_id: dropId,
    p_key: key,
  })
  if (error) throw error
  return data as { drop_id: string; granted: boolean }
}
