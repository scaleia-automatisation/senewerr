import { createClient } from '@/lib/supabase/server'

// Canaux supportés (enum notification_channel en DB)
export type NotifChannel = 'in_app' | 'email'

// Types alignés sur l'enum notification_type en DB (0002_enums.sql)
export type NotifType =
  | 'appointment_confirmed' | 'appointment_reminder' | 'appointment_modified'
  | 'appointment_cancelled' | 'patient_arrived'
  | 'prescription_available' | 'prescription_shared'
  | 'reservation_confirmed' | 'reservation_ready' | 'reservation_expired'
  | 'reservation_refused' | 'pickup_reminder'
  | 'coverage_validated' | 'coverage_refused' | 'coverage_info_requested'
  | 'payment_confirmed' | 'payment_failed' | 'payment_refunded'
  | 'account_validated' | 'account_refused' | 'account_needs_info'
  | 'subscription_renewal' | 'subscription_expired'
  | 'document_available' | 'litige_opened' | 'litige_resolved'

export type NotifCategory =
  | 'rdv' | 'consultations' | 'pharmacie' | 'couverture' | 'paiements' | 'compte' | 'admin'

export const NOTIF_CATEGORY: Record<NotifType, NotifCategory> = {
  appointment_confirmed: 'rdv', appointment_reminder: 'rdv', appointment_modified: 'rdv',
  appointment_cancelled: 'rdv', patient_arrived: 'rdv',
  prescription_available: 'consultations', prescription_shared: 'consultations',
  reservation_confirmed: 'pharmacie', reservation_ready: 'pharmacie',
  reservation_expired: 'pharmacie', reservation_refused: 'pharmacie', pickup_reminder: 'pharmacie',
  coverage_validated: 'couverture', coverage_refused: 'couverture', coverage_info_requested: 'couverture',
  payment_confirmed: 'paiements', payment_failed: 'paiements', payment_refunded: 'paiements',
  account_validated: 'compte', account_refused: 'compte', account_needs_info: 'compte',
  subscription_renewal: 'compte', subscription_expired: 'compte',
  document_available: 'admin', litige_opened: 'admin', litige_resolved: 'admin',
}

// Titres génériques — ne pas révéler de données médicales (spec 19.3)
export const NOTIF_TITLES: Record<NotifType, string> = {
  appointment_confirmed: 'Rendez-vous confirmé',
  appointment_reminder: 'Rappel — rendez-vous à venir',
  appointment_modified: 'Rendez-vous modifié',
  appointment_cancelled: 'Rendez-vous annulé',
  patient_arrived: 'Patient arrivé',
  prescription_available: 'Ordonnance disponible',
  prescription_shared: 'Ordonnance transmise à la pharmacie',
  reservation_confirmed: 'Réservation confirmée',
  reservation_ready: 'Votre commande est prête',
  reservation_expired: 'Réservation expirée',
  reservation_refused: 'Réservation non disponible',
  pickup_reminder: 'Rappel de retrait',
  coverage_validated: 'Prise en charge accordée',
  coverage_refused: 'Prise en charge non accordée',
  coverage_info_requested: 'Informations complémentaires demandées',
  payment_confirmed: 'Paiement confirmé',
  payment_failed: 'Paiement échoué',
  payment_refunded: 'Remboursement effectué',
  account_validated: 'Compte activé',
  account_refused: 'Compte non validé',
  account_needs_info: 'Informations requises pour votre compte',
  subscription_renewal: 'Abonnement à renouveler',
  subscription_expired: 'Abonnement expiré',
  document_available: 'Nouveau document disponible',
  litige_opened: 'Litige ouvert',
  litige_resolved: 'Litige résolu',
}

export type NotifPayload = {
  recipient_id: string        // profile_id du destinataire
  type: NotifType
  body?: string               // texte court, sans données médicales
  reference_type?: string
  reference_id?: string
  channels?: NotifChannel[]
}

type PrefRow = {
  in_app_enabled: boolean
  email_enabled: boolean
  disabled_types: string[] | null
}

// Lit les préférences réelles de la table notification_preferences
async function getEnabledChannels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipientId: string,
  notifType: NotifType,
  requestedChannels: NotifChannel[],
): Promise<NotifChannel[]> {
  try {
    const { data } = await supabase
      .from('notification_preferences')
      .select('in_app_enabled, email_enabled, disabled_types')
      .eq('profile_id', recipientId)
      .maybeSingle() as { data: PrefRow | null }

    if (!data) return requestedChannels // aucune préf → tout activé par défaut

    // Si le type est dans disabled_types, aucun canal
    if (data.disabled_types?.includes(notifType)) return []

    return requestedChannels.filter(ch => {
      if (ch === 'in_app') return data.in_app_enabled !== false
      if (ch === 'email') return data.email_enabled !== false
      return false
    })
  } catch {
    return requestedChannels
  }
}

export async function sendNotification(payload: NotifPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const title = NOTIF_TITLES[payload.type]
    const body = payload.body ?? ''
    const channels = payload.channels ?? (['in_app'] as NotifChannel[])

    const enabledChannels = await getEnabledChannels(supabase, payload.recipient_id, payload.type, channels)

    const notifTable = supabase.from('notifications') as unknown as { insert: (v: unknown) => Promise<unknown> }
    const promises = enabledChannels.map(channel =>
      notifTable.insert({
        recipient_id: payload.recipient_id,
        notification_type: payload.type,
        channel,
        title,
        body,
        is_read: false,
        reference_type: payload.reference_type ?? null,
        reference_id: payload.reference_id ?? null,
      })
    )

    await Promise.allSettled(promises)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function sendBulkNotifications(payloads: NotifPayload[]): Promise<void> {
  await Promise.allSettled(payloads.map(p => sendNotification(p)))
}
