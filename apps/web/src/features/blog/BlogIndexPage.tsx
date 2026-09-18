import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@medikool/shared'
import { formatDate } from '@/lib/utils'
import { Seo } from '@/hooks/useSeo'

type BlogPost = Database['public']['Tables']['blog_posts']['Row']

const TABS = [
  { label: 'Tous', value: '' },
  { label: 'Patients', value: 'patient' },
  { label: 'Professionnels', value: 'professionnel' },
  { label: 'Pharmacies', value: 'pharmacie' },
]

function estimateReadTime(content: string | null): number {
  if (!content) return 3
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('')

  useEffect(() => {
    ;(supabase as any)
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data }: { data: BlogPost[] | null }) => {
        setPosts(data ?? [])
        setLoading(false)
      })
  }, [])

  const filteredPosts =
    activeTab === ''
      ? posts
      : posts.filter(p => {
          const angle = ((p as any).angle ?? '').toLowerCase()
          return angle.includes(activeTab)
        })

  return (
    <div className="min-h-screen bg-bg">
      <Seo
        title="Blog Séne Wérr — Santé numérique au Sénégal"
        description="Conseils santé, guides pratiques et actualités pour les patients et professionnels au Sénégal."
        canonical="/blog"
      />

      {/* Schema.org Blog */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Blog Séne Wérr',
            description:
              'Conseils santé, guides pratiques et actualités pour les patients et professionnels au Sénégal.',
            url: 'https://senewerr.com/blog',
            publisher: {
              '@type': 'Organization',
              name: 'Séne Wérr',
              url: 'https://senewerr.com',
            },
          }),
        }}
      />

      {/* Hero */}
      <div className="border-b border-line bg-surface px-s-4 py-s-10">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-s-3 font-display text-h1 font-semibold text-ink">Blog Séne Wérr</h1>
          <p className="mx-auto max-w-xl text-body text-ink-2">
            Conseils santé, guides pratiques et actualités pour les patients et professionnels au
            Sénégal.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-4xl px-s-4">
          <div className="flex gap-s-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={[
                  'shrink-0 border-b-2 px-s-4 py-s-3 text-small font-medium transition-colors',
                  activeTab === tab.value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-2 hover:text-ink',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Articles */}
      <div className="mx-auto max-w-4xl px-s-4 py-s-8">
        {loading ? (
          <div className="grid gap-s-5 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-s-10 text-center">
            <p className="text-body text-ink-3">Aucun article dans cette catégorie pour le moment.</p>
            {activeTab && (
              <button
                onClick={() => setActiveTab('')}
                className="mt-s-3 text-small text-primary hover:underline"
              >
                Voir tous les articles
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-s-5 md:grid-cols-2">
            {filteredPosts.map(post => {
              const readTime = estimateReadTime(post.content_md)
              return (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group overflow-hidden rounded-xl border border-line bg-surface shadow-1 transition-all hover:shadow-2"
                >
                  {post.cover_image_url && (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-s-5">
                    <div className="mb-s-3 flex flex-wrap items-center gap-s-3 text-micro text-ink-3">
                      {post.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(post.published_at)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {readTime} min
                      </span>
                      {post.author_name && (
                        <span className="text-ink-3">{post.author_name}</span>
                      )}
                    </div>
                    <h2 className="mb-s-2 font-display text-h3 font-semibold leading-snug text-ink transition-colors group-hover:text-primary">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="line-clamp-2 text-small text-ink-2">{post.excerpt}</p>
                    )}
                    <div className="mt-s-4 flex items-center gap-s-1 text-small font-medium text-primary">
                      Lire l'article{' '}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
