import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Calendar, ArrowLeft, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@medikool/shared'
import { formatDate } from '@/lib/utils'
import { PageSpinner } from '@/components/ui/Spinner'

type BlogPost = Database['public']['Tables']['blog_posts']['Row']

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setPost(data)
        setLoading(false)
      })
  }, [slug])

  if (loading) return <PageSpinner />
  if (notFound) return <Navigate to="/blog" replace />

  return (
    <article className="min-h-screen bg-surface">
      {/* Cover */}
      {post?.cover_image_url && (
        <div className="h-64 md:h-96 overflow-hidden">
          <img
            src={post.cover_image_url}
            alt={post?.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="mx-auto max-w-2xl px-s-4 py-s-7">
        <Link
          to="/blog"
          className="mb-s-6 inline-flex items-center gap-s-2 text-small text-ink-2 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au blog
        </Link>

        <div className="mb-s-4 flex items-center gap-s-4 text-small text-ink-3">
          {post?.published_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.published_at)}
            </span>
          )}
          {post?.author_name && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {post.author_name}
            </span>
          )}
        </div>

        <h1 className="mb-s-5 font-display text-h1 font-semibold text-ink">{post?.title}</h1>

        {post?.excerpt && (
          <p className="mb-s-6 border-l-4 border-primary-soft pl-s-4 text-body leading-relaxed text-ink-2">
            {post.excerpt}
          </p>
        )}

        {post?.content_md && (
          <pre className="whitespace-pre-wrap font-sans text-body leading-relaxed text-ink">
            {post.content_md}
          </pre>
        )}
      </div>
    </article>
  )
}
