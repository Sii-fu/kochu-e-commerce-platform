import { isRouteErrorResponse, useRouteError } from 'react-router'
import { ErrorState } from './ErrorState'
import { NotFoundPage } from './NotFoundPage'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

/**
 * Route-level error boundary. The old app had no error.tsx anywhere, so a
 * thrown validation error replaced the entire page with a stack trace and
 * discarded whatever the user had typed.
 */
export function RouteError() {
  const error = useRouteError()

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        {isRouteErrorResponse(error) && error.status === 404 ? (
          <NotFoundPage />
        ) : (
          <ErrorState onRetry={() => window.location.reload()} />
        )}
      </main>
      <Footer />
    </div>
  )
}
