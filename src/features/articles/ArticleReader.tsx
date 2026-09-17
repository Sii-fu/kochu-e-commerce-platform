import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { getArticleBySlug } from '@/lib/supabase/queries'
import { ProductImage } from '@/components/common/ProductImage'
import { Skeleton } from '@/components/ui/skeleton'
import { NotFoundPage } from '@/components/common/NotFoundPage'

// Named `Component`, not `ArticleReader`, because this module is loaded via
// routes.tsx's route-level `lazy()` -- react-router's convention for a lazy
// route module. react-markdown pulls in the whole unified/remark/rehype
// parser tree, which most visitors (browsing products, not reading) never
// need; splitting just this route keeps it out of the main chunk.
export function Component() {
  const { slug } = useParams<{ slug: string }>()

  const { data: article, isLoading, isError } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => getArticleBySlug(slug!),
    enabled: !!slug,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-64 w-full rounded-md" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }

  if (isError || !article) return <NotFoundPage />

  return (
    <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {article.featured_image && (
        <div className="bg-muted aspect-video overflow-hidden rounded-md">
          <ProductImage
            bucket="articles"
            path={article.featured_image}
            alt={article.title}
            className="h-full w-full"
            loading="eager"
          />
        </div>
      )}

      {article.published_at && (
        <p className="text-muted-foreground mt-6 text-xs">
          {new Date(article.published_at).toLocaleDateString('en-BD', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
      <h1 className="font-display mt-2 text-3xl font-semibold">{article.title}</h1>
      <p className="text-muted-foreground mt-3 text-lg">{article.abstract}</p>

      {/* No @tailwindcss/typography plugin in this project -- styled directly
          via component overrides rather than adding a dependency for one page. */}
      <div className="mt-8 space-y-4 text-sm leading-relaxed sm:text-base">
        <ReactMarkdown
          components={{
            h1: ({ ...p }) => <h2 className="font-display pt-2 text-xl font-semibold" {...p} />,
            h2: ({ ...p }) => <h2 className="font-display pt-2 text-xl font-semibold" {...p} />,
            h3: ({ ...p }) => <h3 className="font-display pt-1 text-lg font-medium" {...p} />,
            p: ({ ...p }) => <p {...p} />,
            a: ({ ...p }) => (
              <a className="text-primary underline underline-offset-4" {...p} />
            ),
            ul: ({ ...p }) => <ul className="list-disc space-y-1 pl-5" {...p} />,
            ol: ({ ...p }) => <ol className="list-decimal space-y-1 pl-5" {...p} />,
            blockquote: ({ ...p }) => (
              <blockquote className="border-primary/40 text-muted-foreground border-l-2 pl-4 italic" {...p} />
            ),
            img: ({ ...p }) => <img className="rounded-md" {...p} />,
          }}
        >
          {article.content}
        </ReactMarkdown>
      </div>
    </article>
  )
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
      <Skeleton className="h-64 w-full rounded-md" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}
