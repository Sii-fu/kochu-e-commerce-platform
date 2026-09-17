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
