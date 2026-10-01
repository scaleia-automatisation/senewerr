import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Package, CreditCard, ClipboardList, Lock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Documents — Pharmacie' }

// Spec 20.1 — bibliothèque pharmacie
type DocType = 'justificatif_reservation' | 'facture' | 'recu' | 'document_stock'

const TYPE_META: Record<DocType, { label: string; icon: React.ReactNode; color: string }> = {
  justificatif_reservation: {
    label: 'Justificatif réservation',
    icon: <Package className="w-4 h-4 text-[var(--sw-primary)]" />,
    color: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  },
  facture: {
    label: 'Facture',
    icon: <ClipboardList className="w-4 h-4 text-blue-600" />,
    color: 'bg-blue-50 text-blue-600',
  },
  recu: {
    label: 'Reçu',
    icon: <CreditCard className="w-4 h-4 text-[var(--sw-success)]" />,
    color: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  },
  document_stock: {
    label: 'Document stock',
    icon: <FileText className="w-4 h-4 text-[var(--sw-ink-3)]" />,
    color: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  },
}

type Doc = {
  id: string; type: DocType; title: string; subtitle: string | null
  amount: number | null; status: string; date: string; href: string | null
}

const STATUS_LABELS: Record<string, string> = {
  collected: 'Retiré', ready: 'Prêt', funded: 'Financé', confirmed: 'Confirmé',
  pending: 'En attente', cancelled: 'Annulé', refused: 'Refusé',
}
const STATUS_CLASSES: Record<string, string> = {
  collected: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  ready: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  funded: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  confirmed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  cancelled: 'bg-red-50 text-[var(--sw-danger)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
}

const TABS = [
  { key: '', label: 'Tous' },
  { key: 'justificatif_reservation', label: 'Réservations' },
  { key: 'facture', label: 'Factures' },
  { key: 'recu', label: 'Reçus' },
]

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}

export default async function PharmacieDocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: filterType } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmData } = await supabase.from('pharmacies').select('id, name').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmData as unknown as { id: string; name: string } | null
  if (!pharmacy) redirect('/connexion')

  // Spec 20.2 — fetch all doc sources in parallel
  const [resasRes, paysRes] = await Promise.allSettled([
    supabase
      .from('reservations_pharmacie')
      .select('id, status, created_at, pickup_code, pharmacy_reservation_items(medication_name), patients(profiles(full_name))')
      .eq('pharmacy_id', pharmacy.id)
      .in('status', ['ready', 'collected', 'funded'])
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('paiements')
      .select('id, payment_type, status, amount_fcfa, reference_code, created_at')
      .eq('pharmacy_id', pharmacy.id)
      .in('status', ['confirmed', 'received', 'reconciled'])
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const reservations = resasRes.status === 'fulfilled'
    ? (resasRes.value.data ?? []) as unknown as {
        id: string; status: string; created_at: string; pickup_code: string | null
        pharmacy_reservation_items: { medication_name: string }[]
        patients: { profiles: { full_name: string | null } | null } | null
      }[]
    : []

  const payments = paysRes.status === 'fulfilled'
    ? (paysRes.value.data ?? []) as unknown as {
        id: string; payment_type: string; status: string; amount_fcfa: number; reference_code: string | null; created_at: string
      }[]
    : []

  const docs: Doc[] = [
    // Justificatifs réservation
    ...reservations.map(r => ({
      id: r.id,
      type: 'justificatif_reservation' as DocType,
      title: `Réservation ${r.pickup_code ? `· ${r.pickup_code}` : ''}`,
      subtitle: (r.pharmacy_reservation_items as { medication_name: string }[] | undefined)?.[0]?.medication_name ?? null,
      amount: null,
      status: r.status,
      date: r.created_at,
      href: `/pharmacie/reservations/${r.id}`,
    })),
    // Factures / reçus paiements
    ...payments.map(p => ({
      id: p.id,
      type: (p.payment_type === 'organisme_payment' ? 'facture' : 'recu') as DocType,
      title: `${p.payment_type === 'organisme_payment' ? 'Facture organisme' : 'Reçu paiement'}`,
      subtitle: p.reference_code ?? null,
      amount: p.amount_fcfa,
      status: p.status,
      date: p.created_at,
      href: `/pharmacie/paiements/${p.id}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filtered = filterType ? docs.filter(d => d.type === filterType) : docs

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Documents</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">{pharmacy.name} — bibliothèque spec 20.1</p>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-primary-subtle)]">
        <Lock className="w-4 h-4 text-[var(--sw-primary)] shrink-0" />
        <p className="text-xs text-[var(--sw-primary)]">
          Documents stockés en espace protégé — liens publics permanents désactivés (spec 20.2)
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
