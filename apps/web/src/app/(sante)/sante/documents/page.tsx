import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Stethoscope, ClipboardList, BookOpen, Lock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes documents — Professionnel' }

// Spec 20.1 — bibliothèque professionnel/établissement
type DocType = 'compte_rendu' | 'ordonnance' | 'document_consultation' | 'document_professionnel'

type Doc = {
  id: string; type: DocType; title: string; subtitle: string | null
  status: string; date: string; href: string | null; owner: string
}

const TYPE_META: Record<DocType, { label: string; icon: React.ReactNode; color: string }> = {
  compte_rendu: {
    label: 'Compte rendu',
    icon: <ClipboardList className="w-4 h-4 text-blue-600" />,
    color: 'bg-blue-50 text-blue-600',
  },
  ordonnance: {
    label: 'Ordonnance',
    icon: <FileText className="w-4 h-4 text-orange-600" />,
    color: 'bg-orange-50 text-orange-600',
  },
  document_consultation: {
    label: 'Document consultation',
    icon: <Stethoscope className="w-4 h-4 text-[var(--sw-primary)]" />,
    color: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  },
  document_professionnel: {
    label: 'Document professionnel',
    icon: <BookOpen className="w-4 h-4 text-purple-600" />,
    color: 'bg-purple-50 text-purple-600',
  },
}

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  draft: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  revoked: 'bg-red-50 text-[var(--sw-danger)]',
  completed: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  archived: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Actif', draft: 'Brouillon', revoked: 'Révoquée', completed: 'Clôturé', archived: 'Archivé',
}

const TABS = [
  { key: '', label: 'Tous' },
  { key: 'compte_rendu', label: 'Comptes rendus' },
  { key: 'ordonnance', label: 'Ordonnances' },
  { key: 'document_consultation', label: 'Consultations' },
]

export default async function SanteDocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: filterType } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profData } = await supabase
    .from('professionnels')
    .select('id, specialty, profiles(full_name)')
    .eq('profile_id', user.id)
    .maybeSingle()
  const prof = profData as unknown as { id: string; specialty: string | null; profiles: { full_name: string | null } | null } | null
  if (!prof) redirect('/connexion')

  // Spec 20.2 — fetch from multiple sources in parallel
  const [consultsRes, prescsRes] = await Promise.allSettled([
    supabase
      .from('consultations')
      .select('id, status, created_at, updated_at, patients(profiles(full_name))')
      .eq('professional_id', prof.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('ordonnances')
      .select('id, status, issued_at, patients(profiles(full_name))')
      .eq('professional_id', prof.id)
      .order('issued_at', { ascending: false })
      .limit(100),
  ])

  const consultations = consultsRes.status === 'fulfilled'
    ? (consultsRes.value.data ?? []) as unknown as {
        id: string; status: string; created_at: string; updated_at: string | null
        patients: { profiles: { full_name: string | null } | null } | null
      }[]
    : []

  const prescriptions = prescsRes.status === 'fulfilled'
    ? (prescsRes.value.data ?? []) as unknown as {
        id: string; status: string; issued_at: string
        patients: { profiles: { full_name: string | null } | null } | null
      }[]
    : []

  // Build unified document list (spec 20.1)
  const docs: Doc[] = [
    ...consultations.map(c => ({
      id: c.id,
      type: (c.status === 'completed' ? 'compte_rendu' : 'document_consultation') as DocType,
      title: `Consultation — ${(c.patients as unknown as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name ?? 'Patient'}`,
      subtitle: c.status === 'completed' ? 'Compte rendu disponible' : null,
      status: c.status,
      date: c.updated_at ?? c.created_at,
      href: `/sante/consultations/${c.id}`,
      owner: prof.profiles?.full_name ?? 'Professionnel',
    })),
    ...prescriptions.map(p => ({
      id: p.id,
      type: 'ordonnance' as DocType,
      title: `Ordonnance — ${(p.patients as unknown as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name ?? 'Patient'}`,
      subtitle: null,
      status: p.status,
      date: p.issued_at,
      href: `/sante/ordonnances/${p.id}`,
      owner: prof.profiles?.full_name ?? 'Professionnel',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filtered = filterType ? docs.filter(d => d.type === filterType) : docs

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mes documents</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Bibliothèque — spec 20.1</p>
      </div>

      {/* Spec 20.2 — documents médicaux dans espace protégé */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-primary-subtle)]">
        <Lock className="w-4 h-4 text-[var(--sw-primary)] shrink-0" />
        <p className="text-xs text-[var(--sw-primary)]">
          Documents médicaux stockés dans un espace protégé — accès restreint aux personnes autorisées (spec 20.2)
        </p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map(t => (
          <a key={t.key} href={t.key ? `?type=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (filterType ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {t.label} {t.key ? `(${docs.filter(d => d.type === t.key).length})` : `(${docs.length})`}
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <FileText className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun document.</p>
        </div>
      ) : (
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {filtered.map(doc => {
              const meta = TYPE_META[doc.type]
              const row = (
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{meta.label}</span>
                      {doc.status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_CLASSES[doc.status] ?? ''}`}>
                          {STATUS_LABELS[doc.status] ?? doc.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[var(--sw-ink)] mt-0.5 truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--sw-ink-3)]">
                      <span>{new Date(doc.date).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>· {doc.owner}</span>
                    </div>
                  </div>
                </div>
              )
              return doc.href ? (
                <Link key={doc.id} href={doc.href} className="block hover:bg-[var(--sw-surface-2)] transition-colors">{row}</Link>
              ) : <div key={doc.id}>{row}</div>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
