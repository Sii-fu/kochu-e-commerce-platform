import { useQuery } from '@tanstack/react-query'
import { getProfile } from '@/lib/supabase/queries'
import { useSession } from './useSession'

/**
 * The signed-in user's own `profiles` row -- in particular `role`, which
 * `<RequireAdmin>` reads. Cached by TanStack Query rather than re-fetched on
 * every guard check; a role change only takes effect after this cache is
 * invalidated (a fresh sign-in, or a manual refetch).
 */
export function useProfile() {
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })

  return {
    profile: query.data ?? null,
    // Still "loading" while the session itself is being resolved, even
    // before the profile query is enabled -- otherwise a guard reading only
    // `query.isLoading` would see `false` for one tick before `userId` exists.
    isLoading: sessionLoading || (!!userId && query.isLoading),
    error: query.error,
  }
}
