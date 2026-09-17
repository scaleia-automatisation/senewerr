import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@medikool/shared'
import { formatDate } from '@/lib/utils'

type BlogPost = Database['public']['Tables']['blog_posts']['Row']

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <div className="border-b border-line bg-surface px-s-4 py-s-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-s-3 font-display text-h1 font-semibold text-ink">Blog Medikool</h1>
          <p className="text-body text-ink-2">
            Conseils santé, actualités médicales et guides d'utilisation de la plateforme.
          </p>
        </div>
      </div>

      {/* Articles */}
      <div className="mx-auto max-w-4xl px-s-4 py-s-7">
        {loading ? (
          <div className="grid gap-s-5 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-72 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-s-8 text-center text-ink-3">
            <p className="text-body">Aucun article publié pour le moment.</p>
            <p className="mt-s-2 text-small">Revenez bientôt.</p>
          </div>
        ) : (
          <div className="grid gap-s-5 md:grid-cols-2">
            {posts.map(post => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-lg border border-line bg-surface shadow-1 transition-shadow hover:shadow-2"
              >
                {post.cover_image_url && (
                  <div className="h-48 overflow-hidden">
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-s-5">
                  <div className="mb-s-3 flex items-center gap-s-2 text-micro text-ink-3">
                    <Calendar className="h-3.5 w-3.5" />
                    {post.published_at ? formatDate(post.published_at) : ''}
                  </div>
                  <h2 className="mb-s-2 font-display text-h3 font-semibold text-ink transition-colors group-hover:text-primary">
                    {post.title}
                  </h2>
                  {post.excerpt && <p className="line-clamp-2 text-small text-ink-2">{post.excerpt}</p>}
                  <div className="mt-s-4 flex items-center gap-s-1 text-small font-medium text-primary">
                    Lire l'article <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
