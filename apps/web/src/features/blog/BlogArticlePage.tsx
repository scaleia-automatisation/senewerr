import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Calendar, Clock, ArrowLeft, User, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@medikool/shared'
import { formatDate } from '@/lib/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { Seo } from '@/hooks/useSeo'
import { SchemaArticle, SchemaBreadcrumb } from '@/components/seo/SchemaOrg'

type BlogPost = Database['public']['Tables']['blog_posts']['Row']

// ─── Simple Markdown → HTML renderer ────────────────────────────────────────
// Handles: H1/H2/H3, bold, italic, links, blockquotes (with À retenir callout),
// unordered lists, ordered lists, tables, paragraphs, horizontal rules.

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">$1</code>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-primary underline underline-offset-2 hover:opacity-80">$1</a>'
    )
}

function renderTable(rows: string[]): string {
  let html = '<div class="my-s-6 overflow-x-auto"><table class="w-full text-small border-collapse">'
  rows.forEach((row, i) => {
    if (i === 1 && /^[\s|:-]+$/.test(row.replace(/\|/g, ''))) return // separator row
    const cells = row
      .split('|')
      .map(c => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
    const tag = i === 0 ? 'th' : 'td'
    const cls =
      i === 0
        ? 'border border-line bg-surface-2 px-s-3 py-s-2 font-semibold text-left text-ink'
        : 'border border-line px-s-3 py-s-2 text-ink-2'
    html += '<tr>' + cells.map(c => `<${tag} class="${cls}">${renderInline(c)}</${tag}>`).join('') + '</tr>'
  })
  html += '</table></div>'
  return html
}

function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  let html = ''
  let inUl = false
  let inOl = false
  let inBlockquote = false
  let bqLines: string[] = []
  let tableBuffer: string[] = []
  let inTable = false

  const flushList = () => {
    if (inUl) { html += '</ul>'; inUl = false }
    if (inOl) { html += '</ol>'; inOl = false }
  }
  const flushTable = () => {
    if (inTable && tableBuffer.length) {
      html += renderTable(tableBuffer)
      tableBuffer = []
      inTable = false
    }
  }
  const flushBlockquote = () => {
    if (inBlockquote) {
      const content = bqLines.join(' ').trim()
      const isRetenir = content.startsWith('**À retenir**')
      if (isRetenir) {
        const body = content.replace('**À retenir**', '').replace(/^[\s\n]+/, '')
        html += `<div class="my-s-6 rounded-xl border-l-4 border-primary bg-primary-soft/10 p-s-5">
          <p class="mb-s-2 font-semibold text-primary">À retenir</p>
          <p class="text-small text-ink-2">${renderInline(body)}</p>
        </div>`
      } else {
        html += `<blockquote class="my-s-5 border-l-4 border-line pl-s-4 text-ink-2 italic">${renderInline(content)}</blockquote>`
      }
      bqLines = []
      inBlockquote = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trimEnd()

    // Table detection
    if (line.startsWith('|')) {
      flushList()
      flushBlockquote()
      inTable = true
      tableBuffer.push(line)
      continue
    } else if (inTable) {
      flushTable()
    }

    // Blockquote
    if (line.startsWith('> ')) {
      flushList()
      inBlockquote = true
      bqLines.push(line.slice(2))
      continue
    } else if (inBlockquote && line === '') {
      flushBlockquote()
      continue
    } else if (inBlockquote) {
      // continuation line treated as part of blockquote
      bqLines.push(line)
      continue
    }

    // HR
    if (/^---+$/.test(line)) { flushList(); html += '<hr class="my-s-6 border-line" />'; continue }

    // Headings
    if (line.startsWith('### ')) {
      flushList()
      html += `<h3 class="mt-s-7 mb-s-3 font-display text-h3 font-semibold text-ink">${renderInline(line.slice(4))}</h3>`
      continue
    }
    if (line.startsWith('## ')) {
      flushList()
      html += `<h2 class="mt-s-8 mb-s-3 font-display text-h2 font-semibold text-ink">${renderInline(line.slice(3))}</h2>`
      continue
    }
    if (line.startsWith('# ')) {
      flushList()
      html += `<h1 class="mt-s-8 mb-s-4 font-display text-h1 font-semibold text-ink">${renderInline(line.slice(2))}</h1>`
      continue
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      if (inOl) { html += '</ol>'; inOl = false }
      if (!inUl) { html += '<ul class="my-s-4 list-disc space-y-s-2 pl-s-6 text-body text-ink-2">'; inUl = true }
      html += `<li>${renderInline(line.slice(2))}</li>`
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      if (inUl) { html += '</ul>'; inUl = false }
      if (!inOl) { html += '<ol class="my-s-4 list-decimal space-y-s-2 pl-s-6 text-body text-ink-2">'; inOl = true }
      html += `<li>${renderInline(line.replace(/^\d+\. /, ''))}</li>`
      continue
    }

    // Empty line
    if (line.trim() === '') {
      flushList()
      continue
    }

    // HTML comment (skip)
    if (line.startsWith('<!--')) continue

    // Paragraph
    flushList()
    html += `<p class="my-s-4 text-body leading-relaxed text-ink-2">${renderInline(line)}</p>`
  }

  flushList()
  flushTable()
  flushBlockquote()
  return html
}

function estimateReadTime(content: string | null): number {
  if (!content) return 3
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [related, setRelated] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    setPost(null)
    setRelated([])
    setNotFound(false)
    ;(supabase as any)
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
      .then(async ({ data, error }: { data: BlogPost | null; error: unknown }) => {
        if (error || !data) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setPost(data)
        // Fetch related posts
        const relatedSlugs: string[] = (data as any).related_slugs ?? []
        if (relatedSlugs.length > 0) {
          const { data: relData } = await (supabase as any)
            .from('blog_posts')
            .select('*')
            .in('slug', relatedSlugs.slice(0, 2))
            .eq('status', 'published')
          setRelated(relData ?? [])
        } else {
          // Fallback: last 2 published excluding current
          const { data: fallback } = await (supabase as any)
            .from('blog_posts')
            .select('*')
            .eq('status', 'published')
            .neq('slug', slug)
            .order('published_at', { ascending: false })
            .limit(2)
          setRelated(fallback ?? [])
        }
        setLoading(false)
      })
  }, [slug])

  if (loading) return <PageSpinner />
  if (notFound) return <Navigate to="/blog" replace />
  if (!post) return null

  const baseUrl = 'https://medikool.sn'
  const readTime = estimateReadTime(post.content_md)
  const renderedContent = post.content_md ? renderMarkdown(post.content_md) : ''

  return (
    <article className="min-h-screen bg-bg">
      <Seo
        title={`${post.meta_title ?? post.title} — Blog Medikool`}
        description={post.meta_description ?? post.excerpt ?? post.title}
        canonical={`/blog/${post.slug}`}
        ogType="article"
        ogImage={post.cover_image_url ?? undefined}
        article={{
          publishedTime: post.published_at ?? post.created_at,
          modifiedTime: post.updated_at,
          author: post.author_name ?? 'Équipe médicale Medikool',
        }}
      />
      <SchemaArticle
        title={post.title}
        description={post.meta_description ?? post.excerpt ?? post.title}
        author={post.author_name ?? 'Équipe médicale Medikool'}
        publishedAt={post.published_at ?? post.created_at}
        modifiedAt={post.updated_at}
        url={`${baseUrl}/blog/${post.slug}`}
        imageUrl={post.cover_image_url ?? undefined}
      />
      <SchemaBreadcrumb
        items={[
          { name: 'Accueil', url: '/' },
          { name: 'Blog', url: '/blog' },
          { name: post.title, url: `/blog/${post.slug}` },
        ]}
      />

      {/* Cover image */}
      {post.cover_image_url && (
        <div className="h-56 overflow-hidden md:h-80">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="mx-auto max-w-2xl px-s-4 py-s-7">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mb-s-5 flex flex-wrap items-center gap-s-1 text-small text-ink-3">
          <Link to="/" className="hover:text-primary">Accueil</Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-primary">Blog</Link>
          <span>/</span>
          <span className="line-clamp-1 text-ink-2">{post.title}</span>
        </nav>

        {/* Meta row */}
        <div className="mb-s-4 flex flex-wrap items-center gap-s-4 text-small text-ink-3">
          {post.published_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.published_at)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {readTime} min de lecture
          </span>
          {post.author_name && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {post.author_name}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="mb-s-5 font-display text-h1 font-semibold leading-tight text-ink">
          {post.title}
        </h1>

        {/* Chapô */}
        {post.excerpt && (
          <p className="mb-s-7 border-l-4 border-primary pl-s-4 text-body font-medium leading-relaxed text-ink-2">
            {post.excerpt}
          </p>
        )}

        {/* Article body */}
        <div
          className="prose-article"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />

        {/* CTA section */}
        {((post as any).cta_text || (post as any).cta_url) && (
          <div className="mt-s-10 rounded-xl border border-primary/20 bg-primary-soft/10 p-s-6 text-center">
            <p className="mb-s-4 font-display text-h3 font-semibold text-ink">
              Prêt à simplifier votre parcours de santé ?
            </p>
            <Link
              to={(post as any).cta_url ?? '/auth/inscription'}
              className="inline-flex items-center gap-s-2 rounded-lg bg-primary px-s-5 py-s-3 text-small font-semibold text-white transition-opacity hover:opacity-90"
            >
              {(post as any).cta_text ?? 'Créer mon compte gratuit'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Related articles */}
        {related.length > 0 && (
          <section className="mt-s-10 border-t border-line pt-s-8">
            <h2 className="mb-s-5 font-display text-h2 font-semibold text-ink">Articles liés</h2>
            <div className="grid gap-s-4 sm:grid-cols-2">
              {related.map(r => (
                <Link
                  key={r.id}
                  to={`/blog/${r.slug}`}
                  className="group rounded-xl border border-line bg-surface p-s-4 shadow-1 transition-all hover:shadow-2"
                >
                  <p className="text-small font-medium leading-snug text-ink transition-colors group-hover:text-primary">
                    {r.title}
                  </p>
                  {r.excerpt && (
                    <p className="mt-s-2 line-clamp-2 text-micro text-ink-3">{r.excerpt}</p>
                  )}
                  <span className="mt-s-3 flex items-center gap-1 text-micro font-medium text-primary">
                    Lire <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Back link */}
        <Link
          to="/blog"
          className="mt-s-8 inline-flex items-center gap-s-2 text-small text-ink-2 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au blog
        </Link>
      </div>
    </article>
  )
}
