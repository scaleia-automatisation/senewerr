import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)

    // Patient role only
    if (auth.role !== 'patient') {
      return errorResponse('FORBIDDEN', 'Seuls les patients peuvent partager une ordonnance', 403)
    }

    const { prescriptionId, pharmacyId } = await req.json()
    if (!prescriptionId || !pharmacyId) {
      return errorResponse('MISSING_FIELDS', 'prescriptionId et pharmacyId sont requis', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch patient record for this profile
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .select('id, profile_id')
      .eq('profile_id', auth.profileId)
      .single()

    if (patientErr || !patient) {
      return errorResponse('PATIENT_NOT_FOUND', 'Profil patient introuvable', 404)
    }

    // Fetch prescription
    const { data: prescription, error: presErr } = await supabase
      .from('prescriptions')
      .select('id, patient_id, professional_id, status, valid_until')
      .eq('id', prescriptionId)
      .single()

    if (presErr || !prescription) {
      return errorResponse('PRESCRIPTION_NOT_FOUND', 'Ordonnance introuvable', 404)
    }

    // Verify patient owns this prescription
    if (prescription.patient_id !== patient.id) {
      return errorResponse('FORBIDDEN', 'Cette ordonnance ne vous appartient pas', 403)
    }

    // Verify status allows sharing
    const shareableStatuses = ['available_patient', 'validated_pharmacy']
    if (!shareableStatuses.includes(prescription.status)) {
      return errorResponse(
        'INVALID_STATUS',
        `L'ordonnance au statut '${prescription.status}' ne peut pas être partagée`,
        409
      )
    }

    // Verify prescription not expired
    const today = new Date().toISOString().split('T')[0]
    if (prescription.valid_until < today) {
      return errorResponse('PRESCRIPTION_EXPIRED', 'Cette ordonnance a expiré', 409)
    }

    // Verify pharmacy exists
    const { data: pharmacy, error: pharmErr } = await supabase
      .from('pharmacies')
      .select('id, profile_id')
      .eq('id', pharmacyId)
      .single()

    if (pharmErr || !pharmacy) {
      return errorResponse('PHARMACY_NOT_FOUND', 'Pharmacie introuvable', 404)
    }

    // Check for existing active share with this pharmacy
    const { data: existingShare } = await supabase
      .from('prescription_shares')
      .select('id')
      .eq('prescription_id', prescriptionId)
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'active')
      .maybeSingle()

    if (existingShare) {
      return errorResponse('SHARE_ALREADY_EXISTS', 'Une transmission active existe déjà avec cette pharmacie', 409)
    }

    const now = new Date()
    const validUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()

    // Create prescription share
    const { data: share, error: shareErr } = await supabase
      .from('prescription_shares')
      .insert({
        prescription_id: prescriptionId,
        patient_id: patient.id,
        pharmacy_id: pharmacyId,
        shared_by: auth.profileId,
        status: 'active',
        valid_until: validUntil,
        purpose: 'reservation',
      })
      .select('id, valid_until')
      .single()

    if (shareErr || !share) {
      return errorResponse('SHARE_FAILED', 'Erreur lors du partage de l\'ordonnance', 500, shareErr?.message)
    }

    // Insert consent record
    await supabase.from('consents').insert({
      type: 'prescription_share',
      patient_id: patient.id,
      reference_id: share.id,
      granted_by: auth.profileId,
    })

    // Prescription access log
    await supabase.from('prescription_access_logs').insert({
      prescription_id: prescriptionId,
      accessed_by: auth.profileId,
      action: 'shared',
      pharmacy_id: pharmacyId,
    })

    // Domain event
    await supabase.from('domain_events').insert({
      event_type: 'PRESCRIPTION_SHARED',
      entity_type: 'prescription',
      entity_id: prescriptionId,
      actor_id: auth.profileId,
      actor_role: auth.role,
      patient_id: patient.id,
      payload: { prescriptionId, pharmacyId, shareId: share.id, validUntil },
    })

    // Notify pharmacy
    if (pharmacy.profile_id) {
      await supabase.from('notifications').insert({
        user_id: pharmacy.profile_id,
        type: 'prescription_shared',
        title: 'Nouvelle ordonnance reçue',
        body: 'Un patient vous a transmis une ordonnance',
        data: { prescriptionId, shareId: share.id, validUntil },
      })
    }

    return successResponse({ shareId: share.id, validUntil: share.valid_until })
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Erreur interne', 500, err instanceof Error ? err.message : String(err))
  }
})
