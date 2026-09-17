import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth, isAdmin } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'
import { z } from 'https://esm.sh/zod@3'

const schema = z.object({
  slotId:          z.string().uuid(),
  patientId:       z.string().uuid(),
  beneficiaryId:   z.string().uuid().optional(),
  professionalId:  z.string().uuid(),
  establishmentId: z.string().uuid(),
  appointmentType: z.enum(['in_person','teleconsultation']).default('in_person'),
  reason:          z.string().max(500).optional(),
  patientNotes:    z.string().max(1000).optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  // Seul le patient ou un admin peut créer un RDV
  const allowedRoles = ['patient','establishment_staff','establishment_admin','professional','platform_admin','super_admin']
  if (!allowedRoles.includes(auth.role)) {
    return errorResponse('FORBIDDEN', `Rôle ${auth.role} non autorisé à créer un RDV`, 403)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let body: unknown
  try { body = await req.json() }
  catch { return errorResponse('VALIDATION_ERROR', 'Corps JSON invalide') }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '))
  }

  const data = parsed.data

  // Vérification plan : quota RDV mensuel
  if (auth.role === 'professional') {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0,0,0,0)

    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', data.professionalId)
      .gte('created_at', startOfMonth.toISOString())
      .not('status', 'in', '("cancelled_patient","cancelled_professional","cancelled_establishment","no_show")')

    // Récupère le plan du professionnel
    const { data: wallet } = await supabase
      .from('subscriptions')
      .select('plan_id, subscription_plans(max_appointments_monthly)')
      .eq('profile_id', auth.profileId)
      .in('status', ['active','trialing'])
      .single()

    const maxAppts = (wallet?.subscription_plans as { max_appointments_monthly: number | null } | null)?.max_appointments_monthly
    if (maxAppts !== null && (count ?? 0) >= (maxAppts ?? 20)) {
      return errorResponse('PLAN_LIMIT_REACHED', `Limite de ${maxAppts} RDV/mois atteinte sur votre plan`)
    }
  }

  // Atomicité : UPDATE slot WHERE status='available' — échoue si déjà pris
  const { data: slot, error: slotError } = await supabase
    .from('appointment_slots')
    .update({ status: 'booked' })
    .eq('id', data.slotId)
    .eq('status', 'available')
    .select('starts_at, ends_at, professional_id, establishment_id')
    .single()

  if (slotError || !slot) {
    return errorResponse('SLOT_NOT_AVAILABLE', 'Ce créneau n\'est plus disponible')
  }

  // Crée le RDV
  const { data: appointment, error: apptError } = await supabase
    .from('appointments')
    .insert({
      patient_id:       data.patientId,
      beneficiary_id:   data.beneficiaryId,
      professional_id:  data.professionalId,
      establishment_id: data.establishmentId,
      slot_id:          data.slotId,
      starts_at:        slot.starts_at,
      ends_at:          slot.ends_at,
      appointment_type: data.appointmentType,
      reason:           data.reason,
      patient_notes:    data.patientNotes,
      status:           'confirmed',
      created_by:       auth.profileId,
      created_by_role:  auth.role,
    })
    .select('id, appointment_number, starts_at, ends_at, status')
    .single()

  if (apptError) {
    // Libère le créneau en cas d'erreur
    await supabase.from('appointment_slots').update({ status: 'available' }).eq('id', data.slotId)
    console.error('[create-appointment]', apptError)
    return errorResponse('INTERNAL_ERROR', apptError.message, 500)
  }

  // Lie le slot au RDV
  await supabase
    .from('appointment_slots')
    .update({ appointment_id: appointment!.id })
    .eq('id', data.slotId)

  // Crée accès professionnel → patient (30 jours)
  const validUntil = new Date(slot.starts_at)
  validUntil.setDate(validUntil.getDate() + 30)

  await supabase.from('patient_professional_access').upsert({
    patient_id:      data.patientId,
    professional_id: data.professionalId,
    granted_via:     'appointment',
    appointment_id:  appointment!.id,
    valid_until:     validUntil.toISOString(),
  }, { onConflict: 'patient_id,professional_id' })

  // Historique statut
  await supabase.from('appointment_status_history').insert({
    appointment_id: appointment!.id,
    new_status:    'confirmed',
    changed_by:    auth.profileId,
    changed_by_role: auth.role,
    reason:        'Rendez-vous créé',
  })

  // Événement domaine
  await supabase.rpc('emit_event', {
    p_type:        'APPOINTMENT_CREATED',
    p_entity_type: 'appointment',
    p_entity_id:   appointment!.id,
    p_payload:     { patient_id: data.patientId, professional_id: data.professionalId },
  })

  // Audit
  await supabase.rpc('audit', {
    p_action:      'appointment.create',
    p_entity_type: 'appointment',
    p_entity_id:   appointment!.id,
    p_result:      'success',
  })

  return successResponse(appointment, 201)
})
