import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react'
import { ShareOrdonnanceModal } from '@/components/patient/share-ordonnance-modal'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mon ordonnance' }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', issued: 'Émise', shared: 'Partagée',
  verifying: 'En vérification', validated: 'Validée',
  refused: 'Refusée', expired: 'Expirée', used: 'Utilisée',
}
const STATUS_CLASSES: Record<string, string> = {
  draft:     'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  issued:    'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  shared:    'bg-blue-50 text-blue-600',
  verifying: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  validated: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  refused:   'bg-red-50 text-[var(--sw-danger)]',
  expired:   'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  used:      'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type Item = { id: string; medication_name: string; dosage: string | null; posologie: string | null; duree: string | null; quantite: string | null; renouvellements: number | null }

export default async function PatientOrdonnancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  const [prescRes, itemsRes] = await Promise.all([
    supabase
      .from('prescriptions')
      .select('id, status, created_at, issued_at, valid_until, notes, professionals(title, specialty, profiles(first_name, last_name))')
      .eq('id', id)
      .eq('patient_id', patient.id)
      .maybeSingle(),
    supabase
      .from('prescription_items')
      .select('id, medication_name, dosage, posologie, duree, quantite, renouvellements')
      .eq('prescription_id', id)
      .order('created_at'),
  ])

  const presc = prescRes.data as unknown as {
    id: string; status: string; created_at: string; issued_at: string | null; valid_until: string | null; notes: string | null
    professionals: { title: string | null; specialty: string | null; profiles: { first_name: string | null; last_name: string | null } | null } | null
  } | null

  if (!presc) notFound()

  const items = (itemsRes.data ?? []) as unknown as Item[]
  const pro = (presc.professionals as unknown as { title: string | null; specialty: string | null; profiles: { first_name: string | null; last_name: string | null } | null } | null)
  const proName = pro?.profiles ? `${pro.title ? pro.title + ' ' : ''}${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
  const refNum = `ORD-${presc.id.slice(-6).toUpperCase()}`

  function fmtDate(s: string | null) {
    if (!s) return null
    return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const canShare = presc.status === 'issued'

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <Link href="/patient/dossier/ordonnances" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
        <ArrowLeft className="w-4 h-4" /> Mes ordonnances
      </Link>

      {/* En-tête */}
      <div className="sw-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--sw-ink)]">{refNum}</p>
              {proName && <p className="text-xs text-[var(--sw-ink-2)]">{proName}</p>}
              {pro?.specialty && <p className="text-xs text-[var(--sw-ink-3)]">{pro.specialty}</p>}
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_CLASSES[presc.status] ?? ''}`}>
            {STATUS_LABELS[presc.status] ?? presc.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs border-t border-[var(--sw-line)] pt-3">
          <div><p className="text-[var(--sw-ink-3)]">Date d'émission</p><p className="text-[var(--sw-ink)] font-medium">{fmtDate(presc.issued_at ?? presc.created_at)}</p></div>
          {presc.valid_until && <div><p className="text-[var(--sw-ink-3)]">Valide jusqu'au</p><p className="text-[var(--sw-ink)] font-medium">{fmtDate(presc.valid_until)}</p></div>}
        </div>
      </div>

      {/* Médicaments */}
      <div className="sw-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Médicaments ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--sw-ink-3)]">Aucun médicament enregistré.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="p-3 rounded-xl bg-[var(--sw-surface-2)] space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 text-xs flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                  <p className="text-sm font-bold text-[var(--sw-ink)]">{item.medication_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-7 text-xs">
                  {item.dosage && <div><span className="text-[var(--sw-ink-3)]">Dosage : </span><span className="text-[var(--sw-ink)]">{item.dosage}</span></div>}
                  {item.quantite && <div><span className="text-[var(--sw-ink-3)]">Qté : </span><span className="text-[var(--sw-ink)]">{item.quantite}</span></div>}
                  {item.duree && <div><span className="text-[var(--sw-ink-3)]">Durée : </span><span className="text-[var(--sw-ink)]">{item.duree}</span></div>}
                  {item.renouvellements != null && item.renouvellements > 0 && (
                    <div><span className="text-[var(--sw-ink-3)]">Renouvellements : </span><span className="text-[var(--sw-ink)]">{item.renouvellements}</span></div>
                  )}
                  {item.posologie && <div className="col-span-2 mt-0.5"><span className="text-[var(--sw-ink-3)]">Posologie : </span><span className="text-[var(--sw-ink)]">{item.posologie}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avertissement (spec 14.4) */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[var(--sw-warning-bg)] border border-[var(--sw-warning)]/30">
        <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-warning)]">
          Cette ordonnance numérique doit être vérifiée par le pharmacien. Elle n'est pas automatiquement valide et son utilisation reste soumise aux règles professionnelles et réglementaires en vigueur au Sénégal.
        </p>
      </div>

      {canShare && (
        <ShareOrdonnanceModal prescriptionId={presc.id} patientId={patient.id} />
      )}
    </div>
  )
}
