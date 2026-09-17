import { AuthApiError } from '@supabase/supabase-js'

/**
 * Maps a Supabase Auth error (or an RPC error code raised by a
 * SECURITY DEFINER function -- see supabase/migrations/0006_functions.sql)
 * to copy a customer should actually see. Everything unrecognized falls
 * through to a generic message rather than leaking a raw Postgres error.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    switch (error.code) {
      case 'invalid_credentials':
        return 'That email or password is incorrect.'
      case 'user_already_exists':
      case 'email_exists':
        return 'An account with that email already exists. Try signing in instead.'
      case 'email_address_invalid':
        return 'Enter a valid email address.'
      case 'weak_password':
        return 'Choose a stronger password (at least 8 characters).'
      case 'over_email_send_rate_limit':
        return 'Too many attempts. Wait a few minutes and try again.'
      case 'same_password':
        return 'Choose a different password than your current one.'
      default:
        return error.message
    }
  }

  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

/**
 * Maps the `raise exception '<CODE>'` strings out of create_order() and
 * submit_mfs_transaction() (0006_functions.sql) to copy a customer should
 * actually see. PostgREST surfaces the raised message on `error.message`,
 * unprefixed -- never shown a raw Postgres error here.
 */
export function checkoutErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  switch (message) {
    case 'CART_EMPTY':
      return 'Your cart is empty.'
    case 'INCOMPLETE_DELIVERY_DETAILS':
      return 'Fill in your name, phone, and delivery address.'
    case 'INVALID_PAYMENT_METHOD':
      return 'Choose a payment method.'
    case 'INVALID_QUANTITY':
      return 'One of the quantities in your cart is invalid. Please review your cart.'
    case 'PRODUCT_UNAVAILABLE':
      return 'One or more items in your cart are no longer available. Please review your cart.'
    case 'INSUFFICIENT_STOCK':
      return 'One or more items no longer have enough stock. Please review your cart.'
    case 'DROP_NOT_OPEN':
      return 'A drop item in your cart is not open for purchase yet.'
    case 'INVALID_DISCOUNT':
      return 'That discount code is no longer valid.'
    case 'PAYMENT_METHOD_MISMATCH':
      return 'This order was not placed with that payment method.'
    case 'ORDER_NOT_AWAITING_PAYMENT':
      return 'This order is not waiting on a payment anymore.'
    case 'INCOMPLETE_PAYMENT_DETAILS':
      return 'Enter both the sender number and the transaction ID.'
    case 'TRX_ID_ALREADY_USED':
      return 'That transaction ID has already been submitted for another order.'
    case 'ORDER_NOT_FOUND':
      return 'We could not find that order. Check the link and try again.'
    default:
      return 'Something went wrong placing your order. Please try again.'
  }
}

/**
 * Maps the admin-only RPC error codes -- admin_update_order_status() and
 * verify_mfs_transaction() in 0006_functions.sql -- to copy an admin should
 * see, rather than a raw Postgres error in a toast.
 */
export function adminErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  switch (message) {
    case 'FORBIDDEN':
      return "You don't have permission to do that."
    case 'ORDER_NOT_FOUND':
      return 'That order could not be found.'
    case 'INVALID_STATUS_TRANSITION':
      return "That status change isn't allowed from the order's current status."
    case 'TRANSACTION_NOT_FOUND':
      return 'That payment submission could not be found.'
    case 'TRANSACTION_ALREADY_REVIEWED':
      return 'That payment has already been reviewed.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
