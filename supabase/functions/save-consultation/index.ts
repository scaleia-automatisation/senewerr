import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body:
// { appointment_id, patient_id,
//   motif, type_consultation,
//   subjectif, objectif, analyse, plan,
//   diagnostic_principal, diagnostic_code, diagnostics_secondaires,
//   examens_demandes,
//   resume_patient,
//   constantes: { poids_kg?, taille_cm?, tension_systolique?, tension_diastolique?,
//                 frequence_cardiaque?, temperature_c?, saturation_o2?, glycemie_mmol? }
// }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const {
    appointment_id, patient_id,
    motif, type_consultation,
    subjectif, objectif, analyse, plan,
    diagnostic_principal, diagnostic_code, diagnostics_secondaires,
    examens_demandes,
    resume_patient,
    constantes,
  } = body ?? {}

  if (!patient_id) return errorResponse('INVALID_BODY', 'patient_id requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify care relationship
  const { data: rel } = await admin
    .from('praticien_patients')
    .select('id')
    .eq('praticien_id', auth.profileId)
    .eq('patient_id', patient_id)
    .eq('actif', true)
    .maybeSingle()

  if (!rel) return errorResponse('FORBIDDEN', 'Pas de relation de soin active', 403)

  // Upsert consultation record
  const consultationPayload: Record<string, unknown> = {
    praticien_id:           auth.profileId,
    patient_id,
    appointment_id:         appointment_id ?? null,
    motif:                  motif ?? null,
    type_consultation:      type_consultation ?? 'consultation',
    // SOAP — NEVER visible to patient via RLS
    notes_soap_subjectif:   subjectif ?? null,
    notes_soap_objectif:    objectif ?? null,
    notes_soap_analyse:     analyse ?? null,
    notes_soap_plan:        plan ?? null,
    diagnostic_principal:   diagnostic_principal ?? null,
    diagnostic_code:        diagnostic_code ?? null,
    diagnostics_secondaires:diagnostics_secondaires ?? null,
    examens_demandes:       examens_demandes ?? null,
    // Visible au patient
    resume_patient:         resume_patient ?? null,
    updated_at:             new Date().toISOString(),
  }

  let consultationId: string | null = null

  if (appointment_id) {
    const { data: existing } = await admin
      .from('consultations')
      .select('id')
      .eq('appointment_id', appointment_id)
      .maybeSingle()

    if (existing) {
      await admin.from('consultations').update(consultationPayload).eq('id', existing.id)
      consultationId = existing.id
    } else {
      const { data: ins } = await admin.from('consultations')
        .insert({ ...consultationPayload, created_at: new Date().toISOString() })
        .select('id').single()
      consultationId = ins?.id ?? null
    }
  } else {
    const { data: ins } = await admin.from('consultations')
      .insert({ ...consultationPayload, created_at: new Date().toISOString() })
      .select('id').single()
    consultationId = ins?.id ?? null
  }

  // Save constantes if provided
  if (constantes && consultationId) {
    const hasData = Object.values(constantes).some(v => v !== null && v !== undefined && v !== '')
    if (hasData) {
      await admin.from('constantes_vitales').insert({
        patient_id,
        appointment_id: appointment_id ?? null,
        consultation_id: consultationId,
        mesure_at: new Date().toISOString(),
        poids_kg:             constantes.poids_kg ?? null,
        taille_cm:            constantes.taille_cm ?? null,
        tension_systolique:   constantes.tension_systolique ?? null,
        tension_diastolique:  constantes.tension_diastolique ?? null,
        frequence_cardiaque:  constantes.frequence_cardiaque ?? null,
        temperature_c:        constantes.temperature_c ?? null,
        saturation_o2:        constantes.saturation_o2 ?? null,
        glycemie_mmol:        constantes.glycemie_mmol ?? null,
      })
    }
  }

  // Mark appointment as completed (if linked)
  if (appointment_id) {
    const { data: appt } = await admin.from('appointments')
      .select('status, patient_id, starts_at')
      .eq('id', appointment_id).single()

    if (appt && appt.status === 'in_consultation') {
      await admin.from('appointments').update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      }).eq('id', appointment_id)

      // Notify patient (visible info only — no medical notes)
      const { data: praticien } = await admin.from('profiles').select('full_name').eq('id', auth.profileId).single()
      const drNom = praticien?.full_name ? `Dr. ${praticien.full_name}` : 'Votre médecin'
      const notifCorps = resume_patient
        ? `Votre consultation avec ${drNom} est terminée. ${resume_patient}`
        : `Votre consultation avec ${drNom} est terminée. Consultez votre dossier pour les détails.`

      await admin.from('notifications').insert({
        user_id: patient_id,
        type:    'consultation_terminee',
        titre:   'Consultation terminée',
        corps:   notifCorps,
        data:    { consultation_id: consultationId, appointment_id },
      }).catch(() => {})

      // If examens_demandes → notify patient
      if (examens_demandes) {
        await admin.from('notifications').insert({
          user_id: patient_id,
          type:    'bon_examen_disponible',
          titre:   'Bon d\'examen disponible',
          corps:   `Un bon d'examen a été prescrit par ${drNom}. Consultez vos documents.`,
          data:    { consultation_id: consultationId },
        }).catch(() => {})
      }
    }
  }

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    target_id:  patient_id,
    action:     'consultation_saved',
    table_name: 'consultations',
    metadata:   { consultation_id: consultationId, appointment_id, has_diagnostic: !!diagnostic_principal },
  }).catch(() => {})

  return successResponse({ ok: true, consultation_id: consultationId })
})
