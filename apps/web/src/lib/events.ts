import { createClient } from '@/lib/supabase/server'

export type EventType =
  // Rendez-vous
  | 'appointment.created' | 'appointment.confirmed' | 'appointment.cancelled'
  | 'appointment.patient_arrived' | 'appointment.started' | 'appointment.completed'
  // Consultations
  | 'consultation.started' | 'consultation.completed' | 'consultation.notes_updated'
  // Ordonnances
  | 'prescription.created' | 'prescription.shared' | 'prescription.revoked'
  // Réservations
  | 'reservation.created' | 'reservation.confirmed' | 'reservation.verifying'
  | 'reservation.pending_coverage' | 'reservation.pending_payment'
  | 'reservation.funded' | 'reservation.to_prepare' | 'reservation.preparing'
  | 'reservation.ready' | 'reservation.collected' | 'reservation.refused'
  | 'reservation.cancelled' | 'reservation.expired'
  // Couverture
  | 'coverage.requested' | 'coverage.reviewing' | 'coverage.approved'
  | 'coverage.partial' | 'coverage.refused' | 'coverage.info_required'
  // Paiements
  | 'payment.initiated' | 'payment.confirmed' | 'payment.failed'
  | 'payment.refunded' | 'payment.organisme_received'
  // Système
  | 'system.idempotency_block'

export type ActorType = 'patient' | 'sante' | 'etablissement' | 'pharmacie' | 'couverture' | 'admin' | 'system'
export type ObjectType = 'appointment' | 'consultation' | 'prescription' | 'reservation' | 'coverage_request' | 'payment' | 'profile'

type InsertEventFn = {
  insert: (v: unknown) => { select: (q: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
}
type SelectEventFn = {
  select: (q: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { gte: (c: string, v: string) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } } } }
}

export type EventPayload = {
  event_type: EventType
  actor_id: string
  actor_type: ActorType
  object_type: ObjectType
  object_id: string
  result?: 'success' | 'failure' | 'pending'
  metadata?: Record<string, unknown>
  correlation_id?: string
  recipient_ids?: string[]
  category?: string
}

export function createCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// Spec 18.5 — idempotency: prevent double processing of payment notifications and collection confirmations
const IDEMPOTENT_EVENT_TYPES: EventType[] = [
  'payment.confirmed',
  'reservation.collected',
  'payment.organisme_received',
  'coverage.approved',
]
const IDEMPOTENCY_WINDOW_SECONDS = 60

export async function logEvent(payload: EventPayload): Promise<{ eventId: string | null; blocked: boolean }> {
  try {
    const supabase = await createClient()

    // Idempotency check for sensitive events
    if (IDEMPOTENT_EVENT_TYPES.includes(payload.event_type)) {
      const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_SECONDS * 1000).toISOString()
      const { data: existing } = await (supabase.from('evenements_systeme') as unknown as SelectEventFn)
        .select('id')
        .eq('event_type', payload.event_type)
        .eq('object_id', payload.object_id)
        .gte('created_at', since)
        .limit(1)

      if (existing && existing.length > 0) {
        // Duplicate within window — log the block but do not insert original
        await (supabase.from('evenements_systeme') as unknown as InsertEventFn)
          .insert({
            event_type: 'system.idempotency_block' as EventType,
            actor_id: payload.actor_id,
            actor_type: payload.actor_type,
            object_type: payload.object_type,
            object_id: payload.object_id,
            result: 'failure',
            metadata: { blocked_event: payload.event_type, reason: 'duplicate_within_window' },
            correlation_id: payload.correlation_id ?? null,
            category: 'system',
          })
          .select('id')
          .single()
        return { eventId: null, blocked: true }
      }
    }

    const { data, error } = await (supabase.from('evenements_systeme') as unknown as InsertEventFn)
      .insert({
        event_type: payload.event_type,
        actor_id: payload.actor_id,
        actor_type: payload.actor_type,
        object_type: payload.object_type,
        object_id: payload.object_id,
        result: payload.result ?? 'success',
        metadata: payload.metadata ?? null,
        correlation_id: payload.correlation_id ?? null,
        recipient_ids: payload.recipient_ids ?? null,
        category: payload.category ?? deriveCategory(payload.event_type),
      })
      .select('id')
      .single()

    if (error) return { eventId: null, blocked: false }
    return { eventId: data?.id ?? null, blocked: false }
  } catch {
    return { eventId: null, blocked: false }
  }
}

function deriveCategory(type: EventType): string {
  if (type.startsWith('appointment')) return 'rdv'
  if (type.startsWith('consultation')) return 'consultations'
  if (type.startsWith('prescription')) return 'consultations'
  if (type.startsWith('reservation')) return 'pharmacie'
  if (type.startsWith('coverage')) return 'couverture'
  if (type.startsWith('payment')) return 'paiements'
  return 'system'
}
