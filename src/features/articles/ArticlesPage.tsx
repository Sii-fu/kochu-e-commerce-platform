import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getArticles } from '@/lib/supabase/queries'
import { ProductImage } from '@/components/common/ProductImage'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'

export function ArticlesPage() {
  const { data: articles, isLoading, isError, refetch } = useQuery({
    queryKey: ['articles'],
    queryFn: getArticles,
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold">Journal</h1>

      {isError ? (
        <ErrorState onRetry={() => refetch()} className="mt-8" />
      ) : isLoading ? (
        <div className="mt-8 space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-24 w-32 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : !articles || articles.length === 0 ? (
        <EmptyState className="mt-8" title="No articles yet" />
      ) : (
        <div className="mt-8 divide-y">
          {articles.map((article) => (
            <Link
              key={article.id}
              to={`/articles/${article.slug}`}
              className="group flex gap-4 py-6 first:pt-0"
            >
              <div className="bg-muted h-24 w-32 shrink-0 overflow-hidden rounded-md">
                <ProductImage
                  bucket="articles"
                  path={article.featured_image}
                  alt={article.title}
                  className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div>
                {article.published_at && (
                  <p className="text-muted-foreground text-xs">
                    {new Date(article.published_at).toLocaleDateString('en-BD', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
                <h2 className="font-display mt-1 font-medium">{article.title}</h2>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                  {article.abstract}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
