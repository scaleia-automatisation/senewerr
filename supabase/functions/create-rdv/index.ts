import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { patient_id, type, motif, starts_at, duration_minutes = 30, notes } = body ?? {}
  if (!patient_id || !type || !starts_at) {
    return errorResponse('INVALID_BODY', 'patient_id, type, starts_at requis', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const profId = auth.profileId

  // Vérifier absence de conflit
  const endsAt = new Date(new Date(starts_at).getTime() + duration_minutes * 60000).toISOString()
  const { data: conflicts } = await admin
    .from('appointments')
    .select('id')
    .eq('professional_id', profId)
    .lt('starts_at', endsAt)
    .gt('ends_at', starts_at)
    .not('status', 'in', '(cancelled_patient,cancelled_professional,no_show)')
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return errorResponse('CONFLICT', 'Ce créneau est déjà occupé', 409)
  }

  // Obtenir nom du praticien et patient
  const [profRes, patientRes] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', profId).single(),
    admin.from('profiles').select('full_name, telephone').eq('id', patient_id).single(),
  ])

  const drNom = profRes.data?.full_name ? `Dr. ${profRes.data.full_name}` : 'Votre médecin'
  const dateFormatted = new Date(starts_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeFormatted = new Date(starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  // Créer le RDV
  const { data: appt, error } = await admin
    .from('appointments')
    .insert({
      professional_id: profId,
      patient_id,
      type,
      motif,
      starts_at,
      ends_at: endsAt,
      duration_minutes,
      notes_pro: notes ?? null,
      status: 'confirmed',
    })
    .select('id')
    .single()

  if (error || !appt) return errorResponse('DB_ERROR', 'Création échouée', 500)

  // Notification push patient
  await admin.from('notifications').insert({
    user_id: patient_id,
    type: 'rdv_confirme',
    titre: 'Rendez-vous confirmé',
    corps: `RDV confirmé avec ${drNom} le ${dateFormatted} à ${timeFormatted}.`,
    data: { appointment_id: appt.id },
  }).catch(() => {})

  return successResponse({ appointment_id: appt.id })
})
