import { useQuery } from '@tanstack/react-query'
import { getMfsReceiptUrl } from '@/lib/supabase/storage'

/**
 * `mfs-receipts` is private -- a signed URL is the only way to view one, and
 * it only resolves because the caller is an admin session that passes the
 * bucket's select policy.
 */
export function ReceiptLink({ path }: { path: string | null }) {
  const { data: url } = useQuery({
    queryKey: ['mfs-receipt-url', path],
    queryFn: () => getMfsReceiptUrl(path as string),
    enabled: !!path,
    staleTime: 30 * 60_000,
  })

  if (!path) return <span className="text-muted-foreground text-xs">No receipt attached</span>
  if (!url) return <span className="text-muted-foreground text-xs">Loading receipt…</span>

  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-primary text-xs underline">
      View receipt screenshot
    </a>
  )
}
