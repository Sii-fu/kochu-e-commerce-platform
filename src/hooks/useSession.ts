import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

type SessionState = {
  session: Session | null
  /** True only until the first auth state is known -- never again after. */
  loading: boolean
}

/**
 * The single source of truth for "is anyone signed in, and as whom".
 *
 * Supabase's client resolves the persisted session asynchronously on load, so
 * `loading` exists to distinguish "definitely signed out" from "haven't
 * checked yet" -- guards below read this to avoid bouncing a still-loading
 * visitor to /sign-in before their session has had a chance to rehydrate.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true })

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ session: data.session, loading: false })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setState({ session, loading: false })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
