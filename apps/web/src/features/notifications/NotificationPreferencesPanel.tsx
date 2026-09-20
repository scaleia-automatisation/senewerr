import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'
import { usePushNotifications } from '@/hooks/usePushNotifications'

type NotifType = { key: string; label: string; description: string }
type NotifGroup = { group: string; items: NotifType[] }

const NOTIF_BY_ROLE: Record<string, NotifGroup[]> = {
  patient: [
    {
      group: 'Rendez-vous',
      items: [
        { key: 'appointments',            label: 'Confirmation / annulation',        description: 'Quand un RDV est confirmé ou annulé par le praticien' },
        { key: 'appointment_reminder_day',label: 'Rappel la veille',                description: 'Rappel automatique la veille du rendez-vous' },
        { key: 'appointment_reminder_2h', label: 'Rappel 2h avant',                 description: 'Rappel 2 heures avant l\'heure du rendez-vous' },
      ],
    },
    {
      group: 'Soins',
      items: [
        { key: 'prescriptions', label: 'Ordonnance disponible',   description: 'Nouvelle ordonnance émise par un médecin' },
        { key: 'results',       label: 'Résultats d\'analyses',   description: 'Résultats disponibles dans votre espace' },
        { key: 'reminders',     label: 'Rappels médicaments',     description: 'Rappel de prise de médicaments selon ordonnance' },
      ],
    },
    {
      group: 'Communication',
      items: [
        { key: 'messages', label: 'Nouveaux messages', description: 'Message reçu d\'un professionnel de santé' },
      ],
    },
  ],

  professional: [
    {
      group: 'Agenda',
      items: [
        { key: 'appointments',             label: 'Demande de rendez-vous',   description: 'Nouveau patient demande un RDV' },
        { key: 'new_appointment',          label: 'Rendez-vous confirmé',     description: 'Un rendez-vous vient d\'être confirmé dans votre agenda' },
        { key: 'appointment_reminder_day', label: 'Rappel la veille',         description: 'Récapitulatif de vos RDV du lendemain' },
      ],
    },
    {
      group: 'Patients',
      items: [
        { key: 'new_patients', label: 'Nouveau dossier patient', description: 'Dossier patient ouvert ou transféré vers vous' },
        { key: 'results',      label: 'Résultats reçus',         description: 'Résultats d\'analyses disponibles pour un patient' },
      ],
    },
    {
      group: 'Communication',
      items: [
        { key: 'messages', label: 'Nouveaux messages', description: 'Message reçu d\'un patient' },
        { key: 'reviews',  label: 'Avis patients',     description: 'Un patient a laissé une évaluation' },
      ],
    },
  ],

  establishment_admin: [
    {
      group: 'Agenda',
      items: [
        { key: 'appointments',             label: 'Demande de rendez-vous',   description: 'Nouvelle demande de consultation reçue' },
        { key: 'new_appointment',          label: 'Rendez-vous confirmé',     description: 'Un rendez-vous vient d\'être confirmé' },
        { key: 'appointment_reminder_day', label: 'Rappel la veille',         description: 'Récapitulatif des RDV du lendemain' },
      ],
    },
    {
      group: 'Patients & Documents',
      items: [
        { key: 'new_patients', label: 'Nouveau dossier patient', description: 'Dossier patient reçu ou transféré' },
        { key: 'reports',      label: 'Rapport disponible',      description: 'Rapport ou document généré' },
      ],
    },
    {
      group: 'Communication & Finance',
      items: [
        { key: 'messages', label: 'Nouveaux messages', description: 'Message entrant d\'un patient ou professionnel' },
        { key: 'payments', label: 'Paiement reçu',    description: 'Confirmation de paiement d\'une prestation' },
      ],
    },
  ],

  establishment_staff: [
    {
      group: 'Agenda',
      items: [
        { key: 'appointments',             label: 'Demande de rendez-vous',   description: 'Nouvelle demande de consultation reçue' },
        { key: 'new_appointment',          label: 'Rendez-vous confirmé',     description: 'Un rendez-vous vient d\'être confirmé' },
        { key: 'appointment_reminder_day', label: 'Rappel la veille',         description: 'Récapitulatif des RDV du lendemain' },
      ],
    },
    {
      group: 'Patients',
      items: [
        { key: 'new_patients', label: 'Nouveau dossier patient', description: 'Dossier patient reçu ou transféré' },
        { key: 'messages',     label: 'Nouveaux messages',       description: 'Message entrant' },
      ],
    },
  ],

  pharmacy_admin: [
    {
      group: 'Ordonnances & Réservations',
      items: [
        { key: 'prescriptions',        label: 'Nouvelle ordonnance',              description: 'Ordonnance numérique reçue d\'un patient' },
        { key: 'renewals',             label: 'Demande de renouvellement',        description: 'Patient demande le renouvellement d\'une ordonnance' },
        { key: 'new_reservation',      label: 'Nouvelle réservation',             description: 'Réservation de médicaments reçue d\'un patient' },
        { key: 'reservation_reminder', label: 'Préparer une réservation (30 mn)', description: 'Rappel 30 minutes avant l\'heure de retrait prévue' },
      ],
    },
    {
      group: 'Commerce & Communication',
      items: [
        { key: 'orders',   label: 'Commande en ligne', description: 'Nouvelle commande de médicaments reçue' },
        { key: 'messages', label: 'Nouveaux messages', description: 'Message d\'un patient ou professionnel' },
      ],
    },
  ],

  pharmacy_staff: [
    {
      group: 'Ordonnances & Réservations',
      items: [
        { key: 'prescriptions',        label: 'Nouvelle ordonnance',              description: 'Ordonnance numérique reçue d\'un patient' },
        { key: 'renewals',             label: 'Demande de renouvellement',        description: 'Patient demande le renouvellement d\'une ordonnance' },
        { key: 'new_reservation',      label: 'Nouvelle réservation',             description: 'Réservation de médicaments reçue d\'un patient' },
        { key: 'reservation_reminder', label: 'Préparer une réservation (30 mn)', description: 'Rappel 30 minutes avant l\'heure de retrait prévue' },
      ],
    },
    {
      group: 'Communication',
      items: [
        { key: 'messages', label: 'Nouveaux messages', description: 'Message d\'un patient ou professionnel' },
      ],
    },
  ],

  mutual_admin: [
    {
      group: 'Remboursements',
      items: [
        { key: 'claims',      label: 'Nouvelle demande de remboursement', description: 'Dossier soumis par un assuré' },
        { key: 'validations', label: 'Dossier à valider',                 description: 'Dossier en attente de votre validation' },
        { key: 'disputes',    label: 'Litige / contestation',             description: 'Un assuré conteste une décision de remboursement' },
      ],
    },
    {
      group: 'Communication',
      items: [
        { key: 'messages', label: 'Nouveaux messages', description: 'Message d\'un assuré ou professionnel' },
      ],
    },
  ],

  mutual_staff: [
    {
      group: 'Remboursements',
      items: [
        { key: 'claims',   label: 'Nouvelle demande de remboursement', description: 'Dossier soumis par un assuré' },
        { key: 'disputes', label: 'Litige / contestation',             description: 'Un assuré conteste une décision' },
      ],
    },
    {
      group: 'Communication',
      items: [
        { key: 'messages', label: 'Nouveaux messages', description: 'Message d\'un assuré ou professionnel' },
      ],
    },
  ],
}

export function NotificationPreferencesPanel() {
  const { profile } = useAuth()
  const { isEnabled, toggle, loading, saving } = useNotificationPreferences()
  const { isSupported, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()

  const role = (profile as any)?.role as string | undefined
  const groups = role ? (NOTIF_BY_ROLE[role] ?? NOTIF_BY_ROLE['patient']) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-s-5 max-w-2xl">
      {/* Activation globale push */}
      <div className="rounded-lg border border-line bg-surface p-s-4">
        <div className="flex items-center justify-between gap-s-4">
          <div>
            <p className="text-sm font-semibold text-ink">Notifications push</p>
            <p className="text-xs text-ink-3 mt-0.5">
              {subscribed
                ? 'Activées sur cet appareil'
                : "Activez pour recevoir des alertes même quand l'app est fermée"}
            </p>
          </div>
          {isSupported ? (
            <button
              onClick={subscribed ? unsubscribe : subscribe}
              disabled={pushLoading}
              className={[
                'flex shrink-0 items-center gap-s-2 rounded-md px-s-3 py-s-2 text-sm font-medium transition-colors disabled:opacity-50',
                subscribed
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'bg-surface-2 text-ink-2 hover:bg-surface-3',
              ].join(' ')}
            >
              {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {subscribed ? 'Activées' : 'Désactivées'}
            </button>
          ) : (
            <span className="text-xs text-ink-3">Non supporté sur ce navigateur</span>
          )}
        </div>
      </div>

      {/* Groupes de toggles */}
      {subscribed && groups.length > 0 && (
        <div className="flex flex-col gap-s-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Choisissez vos notifications</h3>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-3" />}
          </div>

          {groups.map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-s-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3 px-s-1">{group}</p>
              {items.map(type => (
                <div
                  key={type.key}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface px-s-4 py-s-3"
                >
                  <div className="flex-1 min-w-0 pr-s-4">
                    <p className="text-sm font-medium text-ink">{type.label}</p>
                    <p className="text-xs text-ink-3 mt-0.5">{type.description}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={isEnabled(type.key)}
                    onClick={() => toggle(type.key)}
                    className={[
                      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isEnabled(type.key) ? 'bg-primary' : 'bg-line',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                        isEnabled(type.key) ? 'translate-x-4' : 'translate-x-0',
                      ].join(' ')}
                    />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {!subscribed && isSupported && (
        <p className="text-xs text-ink-3 text-center py-4">
          Activez les notifications push pour configurer vos préférences.
        </p>
      )}
    </div>
  )
}
