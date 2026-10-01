import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { Video, Clock, Monitor, Shield, Wifi } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  scheduled:  'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  confirmed:  'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  completed:  'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]',
  cancelled:  'bg-[var(--sw-danger-bg)] text-[var(--sw-danger)]',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled:  'Planifiée',
  confirmed:  'Confirmée',
  completed:  'Terminée',
  cancelled:  'Annulée',
}

export default async function TeleconsultationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/sante/teleconsultation')

  const { data: professionalData } = await supabase
    .from('professionnels')
    .select('id, teleconsultation_enabled, teleconsultation_fee_fcfa')
    .eq('profile_id', user.id)
    .single()
  const professional = professionalData as unknown as { id: string; teleconsultation_enabled: boolean | null; teleconsultation_fee_fcfa: number | null } | null

  if (!professional) {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Profil professionnel introuvable.</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: sessions } = await supabase
    .from('rendez_vous')
    .select(`
      id,
      status,
      appointment_date,
      start_time,
      end_time,
      reason,
      patients!inner(
        id,
        profiles!inner(first_name, last_name)
      )
    `)
    .eq('professional_id', professional.id)
    .eq('appointment_type', 'teleconsultation')
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Téléconsultation</h1>
          <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">Gérez vos sessions vidéo à distance</p>
        </div>
        <button className="flex items-center gap-2 bg-[var(--sw-primary)] text-white text-sm font-medium rounded-lg px-4 py-2 hover:opacity-90 transition-opacity">
          <Video className="w-4 h-4" />
          Démarrer une session
        </button>
      </div>

      {/* Statut activation */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${
        professional.teleconsultation_enabled
          ? 'bg-[var(--sw-success-bg)] border-[var(--sw-success)]'
          : 'bg-[var(--sw-warning-bg)] border-[var(--sw-warning)]'
      }`}>
        <div className={`w-2 h-2 rounded-full ${professional.teleconsultation_enabled ? 'bg-[var(--sw-success)]' : 'bg-[var(--sw-warning)]'}`} />
        <div>
          <p className="text-sm font-medium text-[var(--sw-ink)]">
            {professional.teleconsultation_enabled ? 'Téléconsultation activée' : 'Téléconsultation désactivée'}
          </p>
          {professional.teleconsultation_fee_fcfa != null && (
            <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">
              Tarif : {professional.teleconsultation_fee_fcfa.toLocaleString('fr-FR')} FCFA / session
            </p>
          )}
        </div>
      </div>

      {/* Sessions à venir */}
      <div>
        <h2 className="font-semibold text-[var(--sw-ink)] mb-3">Sessions à venir</h2>

        {!sessions || sessions.length === 0 ? (
          <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-8 text-center">
            <Video className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
            <p className="text-[var(--sw-ink-2)] text-sm">Aucune session de téléconsultation à venir</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: any) => {
              const profile = session.patients?.profiles
              const fullName = profile
                ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
                : 'Patient inconnu'

              return (
                <div
                  key={session.id}
                  className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4 flex gap-4"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--sw-info-bg)] flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4 text-[var(--sw-info)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="font-medium text-[var(--sw-ink)]">{fullName}</p>
                      <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${STATUS_STYLES[session.status] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
                        {STATUS_LABELS[session.status] ?? session.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-[var(--sw-ink-3)]">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.appointment_date)} à {session.start_time?.slice(0, 5)}
                      </span>
                    </div>
                    {session.reason && (
                      <p className="text-sm text-[var(--sw-ink-2)] mt-1 line-clamp-1">{session.reason}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Comment ça marche */}
      <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-5">
        <h3 className="font-semibold text-[var(--sw-ink)] mb-4">Comment fonctionne la téléconsultation ?</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Monitor, title: 'Consultation vidéo', desc: 'Consultez vos patients en visioconférence depuis n\'importe quel appareil.' },
            { icon: Shield,  title: 'Sécurisé & confidentiel', desc: 'Les échanges sont chiffrés et conformes aux exigences médicales.' },
            { icon: Wifi,    title: 'Connexion fiable', desc: 'La session démarre dès que patient et médecin sont prêts.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary-subtle)] flex items-center justify-center">
                <Icon className="w-4 h-4 text-[var(--sw-primary)]" />
              </div>
              <p className="text-sm font-medium text-[var(--sw-ink)]">{title}</p>
              <p className="text-xs text-[var(--sw-ink-2)]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
