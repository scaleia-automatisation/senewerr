import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Package, CreditCard, ClipboardList, Filter } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes documents' }

const DOC_TYPES = [
  { key: 'all', label: 'Tous' },
  { key: 'ordonnance', label: 'Ordonnances' },
  { key: 'consultation', label: 'Consultations' },
  { key: 'reservation', label: 'Réservations' },
  { key: 'paiement', label: 'Paiements' },
]

type Doc = {
  id: string; type: string; title: string; subtitle: string | null; status: string
  date: string; href: string
}

function DocIcon({ type }: { type: string }) {
  if (type === 'ordonnance') return <FileText className="w-4 h-4 text-purple-600" />
  if (type === 'consultation') return <ClipboardList className="w-4 h-4 text-blue-600" />
  if (type === 'reservation') return <Package className="w-4 h-4 text-[var(--sw-primary)]" />
  if (type === 'paiement') return <CreditCard className="w-4 h-4 text-[var(--sw-success)]" />
  return <FileText className="w-4 h-4 text-[var(--sw-ink-3)]" />
}

function DocBg({ type }: { type: string }) {
  if (type === 'ordonnance') return 'bg-purple-50'
  if (type === 'consultation') return 'bg-blue-50'
  if (type === 'reservation') return 'bg-[var(--sw-primary-subtle)]'
  if (type === 'paiement') return 'bg-[var(--sw-success-bg)]'
  return 'bg-[var(--sw-surface-2)]'
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', issued: 'Émise', shared: 'Partagée',
  in_progress: 'En cours', completed: 'Terminée',
  new: 'Nouvelle', ready: 'Prête', collected: 'Retirée',
  confirmed: 'Confirmé', pending: 'En attente',
}
const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  issued: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  shared: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  in_progress: 'bg-blue-50 text-blue-600',
  completed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  new: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  ready: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  collected: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  confirmed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PatientDocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: filterType = 'all' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  const docs: Doc[] = []

  await Promise.allSettled([
    // Ordonnances
    (filterType === 'all' || filterType === 'ordonnance') ? (async () => {
      const { data } = await supabase.from('ordonnances').select('id, status, issued_at, created_at, professionals(profiles(full_name))').eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(20)
      for (const r of (data ?? []) as unknown as { id: string; status: string; issued_at: string | null; created_at: string; professionals: { profiles: { full_name: string | null } | null } | null }[]) {
        const proName = (r.professionals as unknown as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name
        docs.push({
          id: r.id, type: 'ordonnance',
          title: `Ordonnance ORD-${r.id.slice(0, 6).toUpperCase()}`,
          subtitle: proName ? `Dr ${proName}` : null,
          status: r.status,
          date: r.issued_at ?? r.created_at,
          href: `/patient/dossier/ordonnances/${r.id}`,
        })
      }
    })() : Promise.resolve(),

    // Consultations
    (filterType === 'all' || filterType === 'consultation') ? (async () => {
      const { data } = await supabase.from('consultations').select('id, status, motif, created_at, professionals(profiles(full_name))').eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(20)
      for (const r of (data ?? []) as unknown as { id: string; status: string; motif: string | null; created_at: string; professionals: { profiles: { full_name: string | null } | null } | null }[]) {
        const proName = (r.professionals as unknown as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name
        docs.push({
          id: r.id, type: 'consultation',
          title: r.motif ? r.motif.slice(0, 50) : 'Consultation',
          subtitle: proName ? `Dr ${proName}` : null,
          status: r.status,
          date: r.created_at,
          href: `/patient/dossier/consultations/${r.id}`,
        })
      }
    })() : Promise.resolve(),

    // Réservations pharmacie
    (filterType === 'all' || filterType === 'reservation') ? (async () => {
      const { data } = await supabase.from('reservations_pharmacie').select('id, status, created_at, pharmacy_reservation_items(medication_name), pharmacies(name)').eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(20)
      for (const r of (data ?? []) as unknown as { id: string; status: string; created_at: string; pharmacy_reservation_items: { medication_name: string }[]; pharmacies: { name: string } | null }[]) {
        const medName = (r.pharmacy_reservation_items as { medication_name: string }[] | undefined)?.[0]?.medication_name ?? null
        const phName = (r.pharmacies as unknown as { name: string } | null)?.name
        docs.push({
          id: r.id, type: 'reservation',
          title: medName ? `Réservation — ${medName}` : 'Réservation',
          subtitle: phName ?? null,
          status: r.status,
          date: r.created_at,
          href: `/patient/pharmacie/reservations/${r.id}`,
        })
      }
    })() : Promise.resolve(),

    // Paiements
    (filterType === 'all' || filterType === 'paiement') ? (async () => {
      const { data } = await supabase.from('paiements').select('id, status, amount_fcfa, payment_type, created_at').eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(20)
      for (const r of (data ?? []) as unknown as { id: string; status: string; amount_fcfa: number; payment_type: string; created_at: string }[]) {
        const amtStr = new Intl.NumberFormat('fr-SN').format(r.amount_fcfa) + ' F CFA'
        const typeLabel = r.payment_type === 'refund' ? 'Remboursement' : 'Paiement'
        docs.push({
          id: r.id, type: 'paiement',
          title: `${typeLabel} — ${amtStr}`,
          subtitle: null,
          status: r.status,
          date: r.created_at,
          href: `/patient/paiements/${r.id}`,
        })
      }
    })() : Promise.resolve(),
  ])

  docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mes documents</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">{docs.length} document{docs.length > 1 ? 's' : ''}</p>
        </div>
        <Filter className="w-4 h-4 text-[var(--sw-ink-3)]" />
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {DOC_TYPES.map(t => (
          <Link key={t.key} href={`?type=${t.key}`}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${t.key === filterType ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)]'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {docs.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <FileText className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun document {filterType !== 'all' ? 'dans cette catégorie' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <Link key={`${doc.type}-${doc.id}`} href={doc.href}
              className="sw-card p-4 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${DocBg({ type: doc.type })}`}>
                <DocIcon type={doc.type} />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{doc.title}</p>
                {doc.subtitle && <p className="text-xs text-[var(--sw-ink-2)]">{doc.subtitle}</p>}
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[doc.status] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'}`}>
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                  <span className="text-xs text-[var(--sw-ink-3)]">{fmtDate(doc.date)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
