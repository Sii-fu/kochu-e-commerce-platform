import { EmptyState } from './EmptyState'

/**
 * Temporary placeholder for a route whose phase has not landed yet.
 *
 * Routes exist from Phase 2 so navigation, guards and deep links can be
 * verified before any of the screens are built. Each one is replaced by a real
 * module as its phase lands; when this component has no remaining callers in
 * routes.tsx, delete it.
 */
export function StubPage({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <EmptyState
        title={title}
        description={`This screen arrives in Phase ${phase}.`}
      />
    </div>
  )
}
