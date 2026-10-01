import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Shield, FileText, CreditCard, ClipboardList, Lock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Documents — Couverture' }

// Spec 20.1 — bibliothèque couverture
type DocType = 'decision' | 'decompte' | 'justificatif_paiement' | 'contrat'

const TYPE_META: Record<DocType, { label: string; icon: React.ReactNode; color: string }> = {
  decision: {
    label: 'Décision',
    icon: <Shield className="w-4 h-4 text-[var(--sw-primary)]" />,
    color: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  },
  decompte: {
    label: 'Décompte',
    icon: <ClipboardList className="w-4 h-4 text-blue-600" />,
    color: 'bg-blue-50 text-blue-600',
  },
  justificatif_paiement: {
    label: 'Justificatif de paiement',
    icon: <CreditCard className="w-4 h-4 text-[var(--sw-success)]" />,
    color: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  },
  contrat: {
    label: 'Contrat',
    icon: <FileText className="w-4 h-4 text-purple-600" />,
    color: 'bg-purple-50 text-purple-600',
  },
}

type Doc = {
  id: string; type: DocType; title: string; subtitle: string | null
  amount: number | null; status: string; date: string; href: string | null
}

const STATUS_LABELS: Record<string, string> = {
  approved: 'Accordé', partial: 'Partiel', refused: 'Refusé', pending: 'En attente',
  reviewing: 'En cours', confirmed: 'Confirmé', received: 'Reçu', reconciled: 'Rapproché',
  authorized: 'Autorisé', info_required: 'Info requise',
}
const STATUS_CLASSES: Record<string, string> = {
  approved: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  partial: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  reviewing: 'bg-blue-50 text-blue-600',
  confirmed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  received: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  reconciled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  authorized: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  info_required: 'bg-orange-50 text-orange-600',
}

const TABS = [
  { key: '', label: 'Tous' },
  { key: 'decision', label: 'Décisions' },
  { key: 'decompte', label: 'Décomptes' },
  { key: 'justificatif_paiement', label: 'Paiements' },
]

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}

export default async function CouvertureDocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: filterType } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase
    .from('organismes_couverture')
    .select('id, name')
    .eq('profile_id', user.id)
    .maybeSingle()
  const organisme = orgData as unknown as { id: string; name: string } | null
  if (!organisme) redirect('/connexion')

  // Spec 20.2 — parallel fetch
  const [coverageRes, paymentsRes] = await Promise.allSettled([
    supabase
      .from('demandes_couverture')
      .select('id, status, created_at, amount_total, amount_covered, amount_patient, pharmacy_reservations(pharmacy_reservation_items(medication_name)), patients(profiles(full_name))')
      .eq('coverage_org_id', organisme.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('paiements')
      .select('id, status, payment_type, amount_fcfa, reference_code, created_at')
      .eq('payer_id', organisme.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const coverageRequests = coverageRes.status === 'fulfilled'
    ? (coverageRes.value.data ?? []) as unknown as {
        id: string; status: string; created_at: string
        amount_total: number | null; amount_covered: number | null; amount_patient: number | null
        pharmacy_reservations: { pharmacy_reservation_items: { medication_name: string }[] } | null
        patients: { profiles: { full_name: string | null } | null } | null
      }[]
    : []

  const payments = paymentsRes.status === 'fulfilled'
    ? (paymentsRes.value.data ?? []) as unknown as {
        id: string; status: string; payment_type: string; amount_fcfa: number; reference_code: string | null; created_at: string
      }[]
    : []

  // Build unified doc list (spec 20.1)
  const docs: Doc[] = [
    // Décisions et décomptes
    ...coverageRequests.map(c => {
      const patName = (c.patients as unknown as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name
      const isTerminal = ['approved', 'partial', 'refused'].includes(c.status)
      return {
        id: c.id,
        type: (isTerminal ? 'decision' : 'decompte') as DocType,
        title: `${isTerminal ? 'Décision' : 'Décompte en cours'} — ${patName ?? 'Adhérent'}`,
        subtitle: c.amount_covered ? `Couvert : ${fmtCFA(c.amount_covered)}` : null,
        amount: c.amount_total,
        status: c.status,
        date: c.created_at,
        href: `/couverture/demandes/${c.id}`,
      }
    }),
    // Justificatifs paiements
    ...payments.map(p => ({
      id: p.id,
      type: 'justificatif_paiement' as DocType,
      title: `Paiement organisme`,
      subtitle: p.reference_code ?? null,
      amount: p.amount_fcfa,
      status: p.status,
      date: p.created_at,
      href: `/couverture/paiements`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filtered = filterType ? docs.filter(d => d.type === filterType) : docs

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Documents</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">{organisme.name} — bibliothèque spec 20.1</p>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-primary-subtle)]">
        <Lock className="w-4 h-4 text-[var(--sw-primary)] shrink-0" />
        <p className="text-xs text-[var(--sw-primary)]">
          Accès restreint — aucun lien public permanent (spec 20.2). Chaque document est lié à son dossier opérationnel.
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
          <Shield className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun document.</p>
        </div>
      ) : (
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {filtered.map(doc => {
              const meta = TYPE_META[doc.type]
              const row = (
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{meta.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_CLASSES[doc.status] ?? ''}`}>
                        {STATUS_LABELS[doc.status] ?? doc.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--sw-ink)] mt-0.5">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--sw-ink-3)]">
                      {doc.subtitle && <span>{doc.subtitle}</span>}
                      {doc.amount && <span className="font-medium">{fmtCFA(doc.amount)}</span>}
                      <span>· {new Date(doc.date).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
