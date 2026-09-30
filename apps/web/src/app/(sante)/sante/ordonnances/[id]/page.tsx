import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ordonnance' }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', issued: 'Émise', shared: 'Partagée',
  verifying: 'En vérification', validated: 'Validée',
  refused: 'Refusée', expired: 'Expirée', used: 'Utilisée',
}
const STATUS_CLASSES: Record<string, string> = {
  draft:      'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  issued:     'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  shared:     'bg-blue-50 text-blue-600',
  verifying:  'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  validated:  'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  refused:    'bg-red-50 text-[var(--sw-danger)]',
  expired:    'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  used:       'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type Item = { id: string; medication_name: string; dosage: string | null; posologie: string | null; duree: string | null; quantite: string | null; renouvellements: number | null }

export default async function OrdonnanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: proData } = await supabase.from('professionals').select('id').eq('profile_id', user.id).maybeSingle()
  const pro = proData as unknown as { id: string } | null
  if (!pro) redirect('/connexion')

  const [prescRes, itemsRes] = await Promise.all([
    supabase
      .from('prescriptions')
      .select('id, status, created_at, issued_at, valid_until, notes, consultation_id, patients(profiles(first_name, last_name, date_of_birth)), establishments(name)')
      .eq('id', id)
      .eq('professional_id', pro.id)
      .maybeSingle(),
    supabase
      .from('prescription_items')
      .select('id, medication_name, dosage, posologie, duree, quantite, renouvellements')
      .eq('prescription_id', id)
      .order('created_at'),
  ])

  const presc = prescRes.data as unknown as {
    id: string; status: string; created_at: string; issued_at: string | null; valid_until: string | null; notes: string | null
    consultation_id: string | null
    patients: { profiles: { first_name: string | null; last_name: string | null; date_of_birth: string | null } | null } | null
    establishments: { name: string } | null
  } | null

  if (!presc) notFound()

  const items = (itemsRes.data ?? []) as unknown as Item[]
  const p = (presc.patients as unknown as { profiles: { first_name: string | null; last_name: string | null; date_of_birth: string | null } | null } | null)?.profiles
  const patientName = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null
  const refNum = `ORD-${presc.id.slice(-6).toUpperCase()}`

  function fmtDate(s: string | null) {
    if (!s) return null
    return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const isEditable = presc.status === 'draft'

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={presc.consultation_id ? `/sante/consultations/${presc.consultation_id}` : '/sante/consultations'}
          className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
          <ArrowLeft className="w-4 h-4" /> {presc.consultation_id ? 'Consultation' : 'Consultations'}
        </Link>
      </div>

      {/* En-tête ordonnance */}
      <div className="sw-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--sw-ink)]">{refNum}</p>
              {patientName && <p className="text-xs text-[var(--sw-ink-2)]">{patientName}</p>}
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_CLASSES[presc.status] ?? ''}`}>
            {STATUS_LABELS[presc.status] ?? presc.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-[var(--sw-ink-3)]">Émission</p><p className="text-[var(--sw-ink)] font-medium">{fmtDate(presc.issued_at ?? presc.created_at)}</p></div>
          {presc.valid_until && <div><p className="text-[var(--sw-ink-3)]">Validité</p><p className="text-[var(--sw-ink)] font-medium">{fmtDate(presc.valid_until)}</p></div>}
        </div>

        {presc.notes && (
          <p className="text-xs text-[var(--sw-ink-2)] border-t border-[var(--sw-line)] pt-3">{presc.notes}</p>
        )}
      </div>

      {/* Médicaments */}
      <div className="sw-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Médicaments prescrits ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--sw-ink-3)]">Aucun médicament enregistré.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="p-3 rounded-xl bg-[var(--sw-surface-2)] space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] text-xs flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                  <p className="text-sm font-bold text-[var(--sw-ink)]">{item.medication_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-7 text-xs">
                  {item.dosage && <div><span className="text-[var(--sw-ink-3)]">Dosage : </span><span className="text-[var(--sw-ink)]">{item.dosage}</span></div>}
                  {item.quantite && <div><span className="text-[var(--sw-ink-3)]">Qté : </span><span className="text-[var(--sw-ink)]">{item.quantite}</span></div>}
                  {item.duree && <div><span className="text-[var(--sw-ink-3)]">Durée : </span><span className="text-[var(--sw-ink)]">{item.duree}</span></div>}
                  {item.renouvellements != null && item.renouvellements > 0 && (
                    <div><span className="text-[var(--sw-ink-3)]">Renouvellements : </span><span className="text-[var(--sw-ink)]">{item.renouvellements}</span></div>
                  )}
                  {item.posologie && <div className="col-span-2"><span className="text-[var(--sw-ink-3)]">Posologie : </span><span className="text-[var(--sw-ink)]">{item.posologie}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avertissement conformité (spec 14.4) */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[var(--sw-warning-bg)] border border-[var(--sw-warning)]/30">
        <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-warning)]">
          Cette ordonnance numérique ne remplace pas la vérification professionnelle. Sa validité légale est soumise à la réglementation en vigueur au Sénégal, notamment en matière de signature électronique et de prescription médicale.
        </p>
      </div>

      {isEditable && (
        <Link href={`/sante/ordonnances/nouveau?prescriptionId=${presc.id}&consultationId=${presc.consultation_id ?? ''}`}
          className="w-full py-2.5 rounded-xl border border-[var(--sw-primary)] text-[var(--sw-primary)] text-sm font-medium hover:bg-[var(--sw-primary-subtle)] flex items-center justify-center gap-2">
          Modifier le brouillon
        </Link>
      )}
    </div>
  )
}
