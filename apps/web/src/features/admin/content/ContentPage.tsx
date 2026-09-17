import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Banner } from '@/components/ui/Banner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR')

// ─────────────────────────────────────────────
// TÉMOIGNAGES
// ─────────────────────────────────────────────
interface Testimonial {
  id: string
  author_name: string
  content: string
  rating?: number
  approved: boolean
  order_index: number
  created_at: string
}

function TestimonialsTab() {
  const [items, setItems] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ author_name: '', content: '', rating: '5' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('testimonials')
      .select('id, author_name, content, rating, approved, order_index, created_at')
      .order('order_index', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = useCallback(async (item: Testimonial) => {
    await (supabase as any).from('testimonials').update({ approved: !item.approved }).eq('id', item.id)
    setItems((prev) => prev.map((t) => t.id === item.id ? { ...t, approved: !t.approved } : t))
  }, [])

  const move = useCallback(async (item: Testimonial, dir: -1 | 1) => {
    const idx = items.findIndex((t) => t.id === item.id)
    if (idx + dir < 0 || idx + dir >= items.length) return
    const other = items[idx + dir]
    await Promise.all([
      (supabase as any).from('testimonials').update({ order_index: other.order_index }).eq('id', item.id),
      (supabase as any).from('testimonials').update({ order_index: item.order_index }).eq('id', other.id),
    ])
    load()
  }, [items, load])

  const add = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      await (supabase as any).from('testimonials').insert({
        author_name: form.author_name,
        content: form.content,
        rating: Number(form.rating),
        approved: false,
        order_index: items.length + 1,
      })
      setAddOpen(false)
      setForm({ author_name: '', content: '', rating: '5' })
      setSuccess('Témoignage ajouté.')
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }, [form, items.length, load])

  return (
    <div className="flex flex-col gap-s-4">
      {success && <Banner kind="info">{success}</Banner>}
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => { setAddOpen(true); setError('') }}>Ajouter</Button>
      </div>
      {loading
        ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded" />)
        : items.map((t, idx) => (
          <Card key={t.id} className="p-s-3 flex items-start gap-s-3">
            <div className="flex flex-col gap-s-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => move(t, -1)} disabled={idx === 0}>↑</Button>
              <Button variant="ghost" size="sm" onClick={() => move(t, 1)} disabled={idx === items.length - 1}>↓</Button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-s-2 mb-s-1">
                <span className="font-medium text-ink">{t.author_name}</span>
                <span className="text-xs text-ink-3">{'★'.repeat(t.rating ?? 5)}</span>
                <Badge variant={t.approved ? 'success' : 'neutral'}>{t.approved ? 'Approuvé' : 'En attente'}</Badge>
              </div>
              <p className="text-sm text-ink-2 line-clamp-2">{t.content}</p>
            </div>
            <Button
              variant={t.approved ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => toggle(t)}
            >
              {t.approved ? 'Refuser' : 'Approuver'}
            </Button>
          </Card>
        ))
      }

      <Modal open={addOpen} onOpenChange={(v) => { if (!v) setAddOpen(false) }} title="Ajouter un témoignage" size="md">
        <div className="flex flex-col gap-s-4">
          <Input label="Auteur" value={form.author_name} onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))} />
          <Textarea label="Contenu" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={4} />
          <Select
            label="Note"
            value={form.rating}
            onValueChange={(v) => setForm((f) => ({ ...f, rating: v }))}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} étoile${n > 1 ? 's' : ''}` }))}
          />
          {error && <p className="text-sm text-status-danger">{error}</p>}
          <div className="flex justify-end gap-s-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saving} onClick={add} disabled={!form.author_name || !form.content}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────
interface FaqItem {
  id: string
  question: string
  answer: string
  category?: string
  order_index?: number
}

function FaqTab() {
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<FaqItem | null>(null)
  const [form, setForm] = useState({ question: '', answer: '', category: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('faq_items')
      .select('id, question, answer, category, order_index')
      .order('order_index', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (item: FaqItem | null) => {
    setEditTarget(item)
    setForm(item ? { question: item.question, answer: item.answer, category: item.category ?? '' } : { question: '', answer: '', category: '' })
    setError('')
  }

  const save = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      if (editTarget?.id && editTarget.id !== 'new') {
        await (supabase as any).from('faq_items').update({ question: form.question, answer: form.answer, category: form.category }).eq('id', editTarget.id)
      } else {
        await (supabase as any).from('faq_items').insert({ question: form.question, answer: form.answer, category: form.category, order_index: items.length + 1 })
      }
      setEditTarget(null)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }, [editTarget, form, items.length, load])

  const del = useCallback(async (id: string) => {
    await (supabase as any).from('faq_items').delete().eq('id', id)
    setItems((prev) => prev.filter((f) => f.id !== id))
  }, [])

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => openEdit({ id: 'new', question: '', answer: '', category: '' })}>Nouveau</Button>
      </div>
      {loading
        ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)
        : items.map((item) => (
          <Card key={item.id} className="p-s-3 flex items-start justify-between gap-s-3">
            <div className="flex-1 min-w-0">
              {item.category && <p className="text-xs text-ink-3 mb-s-1">{item.category}</p>}
              <p className="font-medium text-ink">{item.question}</p>
              <p className="text-sm text-ink-2 line-clamp-1 mt-s-1">{item.answer}</p>
            </div>
            <div className="flex gap-s-1 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>Modifier</Button>
              <Button variant="danger" size="sm" onClick={() => del(item.id)}>Supprimer</Button>
            </div>
          </Card>
        ))
      }

      <Modal open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null) }} title={editTarget?.id === 'new' ? 'Nouvelle FAQ' : 'Modifier FAQ'} size="lg">
        <div className="flex flex-col gap-s-4">
          <Input label="Question" value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
          <Textarea label="Réponse" value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} rows={5} />
          <Input label="Catégorie" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          {error && <p className="text-sm text-status-danger">{error}</p>}
          <div className="flex justify-end gap-s-2">
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Annuler</Button>
            <Button variant="primary" loading={saving} onClick={save} disabled={!form.question || !form.answer}>Sauvegarder</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────
// BLOG
// ─────────────────────────────────────────────
interface BlogPost {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published' | string
  published_at?: string | null
  content?: string
  meta_title?: string
  meta_desc?: string
}

function BlogTab() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<BlogPost | null>(null)
  const [form, setForm] = useState({ title: '', slug: '', content: '', meta_title: '', meta_desc: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('blog_posts')
      .select('id, title, slug, status, published_at, content, meta_title, meta_desc')
      .order('published_at', { ascending: false, nullsFirst: true })
    setPosts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (post: BlogPost | null) => {
    setEditTarget(post)
    setForm(post ? { title: post.title, slug: post.slug, content: post.content ?? '', meta_title: post.meta_title ?? '', meta_desc: post.meta_desc ?? '' }
      : { title: '', slug: '', content: '', meta_title: '', meta_desc: '' })
    setError('')
  }

  const save = useCallback(async (publish?: boolean) => {
    setSaving(true)
    setError('')
    try {
      const payload: any = { ...form, status: publish ? 'published' : 'draft' }
      if (publish) payload.published_at = new Date().toISOString()
      if (editTarget?.id && editTarget.id !== 'new') {
        await (supabase as any).from('blog_posts').update(payload).eq('id', editTarget.id)
      } else {
        await (supabase as any).from('blog_posts').insert(payload)
      }
      setEditTarget(null)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }, [editTarget, form, load])

  const togglePublish = useCallback(async (post: BlogPost) => {
    const update = post.status === 'published'
      ? { status: 'draft', published_at: null }
      : { status: 'published', published_at: new Date().toISOString() }
    await (supabase as any).from('blog_posts').update(update).eq('id', post.id)
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, ...update } : p))
  }, [])

  // Simple markdown render (no external deps)
  const renderMarkdown = (md: string) =>
    md
      .replace(/^# (.+)$/gm, '<h1 class="text-h2 font-bold mb-2">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 class="text-h3 font-semibold mb-2 mt-4">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p class="mb-2">')
      .replace(/^(?!<)(.+)$/gm, '<p class="mb-2">$1</p>')

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => openEdit({ id: 'new', title: '', slug: '', status: 'draft' })}>Nouveau</Button>
      </div>
      {loading
        ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)
        : posts.map((post) => (
          <Card key={post.id} className="p-s-3 flex items-center justify-between gap-s-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ink">{post.title}</p>
              <div className="flex items-center gap-s-2 mt-s-1">
                <Badge variant={post.status === 'published' ? 'success' : 'neutral'}>{post.status}</Badge>
                <span className="text-xs text-ink-3 font-mono">/{post.slug}</span>
                {post.published_at && <span className="text-xs text-ink-3">{fmt(post.published_at)}</span>}
              </div>
            </div>
            <div className="flex gap-s-1 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => openEdit(post)}>Modifier</Button>
              <Button
                variant={post.status === 'published' ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => togglePublish(post)}
              >
                {post.status === 'published' ? 'Dépublier' : 'Publier'}
              </Button>
            </div>
          </Card>
        ))
      }

      <Modal open={!!editTarget} onOpenChange={(v) => { if (!v) { setEditTarget(null); setPreviewOpen(false) } }} title={editTarget?.id === 'new' ? 'Nouvel article' : 'Modifier article'} size="xl">
        <div className="flex flex-col gap-s-4">
          <Input label="Titre" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="mon-article" />
          <div>
            <div className="flex items-center justify-between mb-s-2">
              <label className="text-small font-medium text-ink-2">Contenu (Markdown)</label>
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)} disabled={!form.content}>Prévisualiser</Button>
            </div>
            <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={12} placeholder="# Titre\n\nContenu…" />
          </div>
          <Input label="Meta titre" value={form.meta_title} onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))} />
          <Textarea label="Meta description" value={form.meta_desc} onChange={(e) => setForm((f) => ({ ...f, meta_desc: e.target.value }))} rows={2} />
          {error && <p className="text-sm text-status-danger">{error}</p>}
          <div className="flex justify-end gap-s-2">
            <Button variant="secondary" onClick={() => { setEditTarget(null); setPreviewOpen(false) }}>Annuler</Button>
            <Button variant="secondary" loading={saving} onClick={() => save(false)}>Enregistrer brouillon</Button>
            <Button variant="primary" loading={saving} onClick={() => save(true)}>Publier</Button>
          </div>
        </div>
      </Modal>

      <Modal open={previewOpen} onOpenChange={(v) => { if (!v) setPreviewOpen(false) }} title="Prévisualisation" size="xl">
        <div className="prose prose-sm max-w-none text-ink overflow-y-auto max-h-[60vh]"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }} />
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────
// PAGES LÉGALES
// ─────────────────────────────────────────────
interface LegalPage {
  id: string
  slug: string
  title: string
  content?: string
  version?: number
  updated_at: string
}

function LegalTab() {
  const [pages, setPages] = useState<LegalPage[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<LegalPage | null>(null)
  const [form, setForm] = useState({ title: '', content: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('legal_pages')
      .select('id, slug, title, version, updated_at')
      .order('slug', { ascending: true })
    setPages(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = useCallback(async (page: LegalPage) => {
    const { data } = await (supabase as any)
      .from('legal_pages')
      .select('id, slug, title, content, version')
      .eq('id', page.id)
      .single()
    setEditTarget(data ?? page)
    setForm({ title: data?.title ?? page.title, content: data?.content ?? '' })
    setError('')
  }, [])

  const save = useCallback(async () => {
    if (!editTarget) return
    setSaving(true)
    setError('')
    try {
      // Versioned save: insert new row
      await (supabase as any).from('legal_pages').insert({
        slug: editTarget.slug,
        title: form.title,
        content: form.content,
        version: (editTarget.version ?? 1) + 1,
      })
      setEditTarget(null)
      setSuccess('Page légale sauvegardée (nouvelle version).')
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }, [editTarget, form, load])

  return (
    <div className="flex flex-col gap-s-4">
      {success && <Banner kind="info">{success}</Banner>}
      {loading
        ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)
        : pages.map((page) => (
          <Card key={page.id} className="p-s-3 flex items-center justify-between gap-s-3">
            <div>
              <p className="font-medium text-ink">{page.title}</p>
              <div className="flex items-center gap-s-2 mt-s-1">
                <span className="text-xs text-ink-3 font-mono">/{page.slug}</span>
                <span className="text-xs text-ink-3">v{page.version ?? 1} — {fmt(page.updated_at)}</span>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => openEdit(page)}>Modifier</Button>
          </Card>
        ))
      }

      <Modal open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null) }} title={`Modifier : ${editTarget?.title}`} size="xl">
        <div className="flex flex-col gap-s-4">
          <Input label="Titre" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Textarea label="Contenu (Markdown)" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={15} />
          <p className="text-xs text-ink-3">Une sauvegarde crée une nouvelle version. L'ancienne est conservée.</p>
          {error && <p className="text-sm text-status-danger">{error}</p>}
          <div className="flex justify-end gap-s-2">
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Annuler</Button>
            <Button variant="primary" loading={saving} onClick={save}>Sauvegarder nouvelle version</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function ContentPage() {
  useAdminAudit('contenu')
  const [tab, setTab] = useState('testimonials')

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Contenu</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="testimonials">Témoignages</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="legal">Pages légales</TabsTrigger>
        </TabsList>

        <TabsContent value="testimonials"><TestimonialsTab /></TabsContent>
        <TabsContent value="faq"><FaqTab /></TabsContent>
        <TabsContent value="blog"><BlogTab /></TabsContent>
        <TabsContent value="legal"><LegalTab /></TabsContent>
      </Tabs>
    </div>
  )
}
