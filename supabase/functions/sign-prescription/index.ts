import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Generate a SHA-256 hex hash
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Generate prescription number: ORD-YYYYMM-XXXXXX
function generatePrescriptionNumber(): string {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const random = Math.floor(100000 + Math.random() * 900000).toString()
  return `ORD-${yyyymm}-${random}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)

    if (auth.role !== 'professional') {
      return errorResponse('FORBIDDEN', 'Seuls les professionnels peuvent signer une ordonnance', 403)
    }

    const { prescriptionId } = await req.json()
    if (!prescriptionId) {
      return errorResponse('MISSING_FIELDS', 'prescriptionId est requis', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch professional record + verification status
    const { data: professional, error: proErr } = await supabase
      .from('professionals')
      .select('id, profile_id, verification_status')
      .eq('profile_id', auth.profileId)
      .single()

    if (proErr || !professional) {
      return errorResponse('PROFESSIONAL_NOT_FOUND', 'Profil professionnel introuvable', 404)
    }

    if (professional.verification_status !== 'verified') {
      return errorResponse('PROFESSIONAL_NOT_VERIFIED', 'Votre compte professionnel n\'est pas vérifié', 403)
    }

    // Fetch prescription
    const { data: prescription, error: presErr } = await supabase
      .from('prescriptions')
      .select('id, patient_id, professional_id, consultation_id, establishment_id, status')
      .eq('id', prescriptionId)
      .single()

    if (presErr || !prescription) {
      return errorResponse('PRESCRIPTION_NOT_FOUND', 'Ordonnance introuvable', 404)
    }

    if (prescription.professional_id !== professional.id) {
      return errorResponse('FORBIDDEN', 'Cette ordonnance ne vous appartient pas', 403)
    }

    if (prescription.status !== 'draft') {
      return errorResponse('INVALID_STATUS', `L'ordonnance est déjà '${prescription.status}'`, 409)
    }

    // Check at least one item
    const { count: itemCount } = await supabase
      .from('prescription_items')
      .select('id', { count: 'exact', head: true })
      .eq('prescription_id', prescriptionId)

    if (!itemCount || itemCount < 1) {
      return errorResponse('NO_ITEMS', 'L\'ordonnance doit contenir au moins un médicament', 400)
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const validUntil = new Date(now)
    validUntil.setDate(validUntil.getDate() + 90)
    const validUntilDate = validUntil.toISOString().split('T')[0]

    // Generate identifiers
    const prescriptionNumber = generatePrescriptionNumber()
    const qrToken = crypto.randomUUID()
    const signatureHash = await sha256Hex(`${prescriptionId}-${nowIso}`)

    // Update prescription: sign it
    const { error: signErr } = await supabase
      .from('prescriptions')
      .update({
        status: 'signed',
        signed_at: nowIso,
        issued_at: nowIso,
        prescription_number: prescriptionNumber,
        qr_token: qrToken,
        signature_hash: signatureHash,
        valid_until: validUntilDate,
        pdf_document_id: null,
      })
      .eq('id', prescriptionId)

    if (signErr) {
      return errorResponse('SIGN_FAILED', 'Erreur lors de la signature', 500, signErr.message)
    }

    // Immediately transition to available_patient
    await supabase
      .from('prescriptions')
      .update({ status: 'available_patient' })
      .eq('id', prescriptionId)

    // Domain event
    await supabase.from('domain_events').insert({
      event_type: 'PRESCRIPTION_CREATED',
      entity_type: 'prescription',
      entity_id: prescriptionId,
      actor_id: auth.profileId,
      actor_role: auth.role,
      patient_id: prescription.patient_id,
      payload: { prescriptionId, prescriptionNumber, signedAt: nowIso, validUntil: validUntilDate },
    })

    // Fetch patient profile_id for notification
    const { data: patientRecord } = await supabase
      .from('patients')
      .select('profile_id')
      .eq('id', prescription.patient_id)
      .single()

    if (patientRecord?.profile_id) {
      await supabase.from('notifications').insert({
        user_id: patientRecord.profile_id,
        type: 'prescription_available',
        title: 'Nouvelle ordonnance disponible',
        body: `Une nouvelle ordonnance est disponible (${prescriptionNumber})`,
        data: { prescriptionId, prescriptionNumber },
      })
    }

    // Fetch prescription items for health records
    const { data: items } = await supabase
      .from('prescription_items')
      .select('medicine_name, dosage, form')
      .eq('prescription_id', prescriptionId)

    if (items && items.length > 0) {
      const healthRecords = items.map((item) => ({
        patient_id: prescription.patient_id,
        type: 'traitement',
        description: `${item.medicine_name}${item.dosage ? ' - ' + item.dosage : ''}${item.form ? ' (' + item.form + ')' : ''}`,
        reference_id: prescriptionId,
        reference_type: 'prescription',
        professional_id: professional.id,
        establishment_id: prescription.establishment_id,
      }))
      await supabase.from('health_records').insert(healthRecords)
    }

    // Prescription access log
    await supabase.from('prescription_access_logs').insert({
      prescription_id: prescriptionId,
      accessed_by: auth.profileId,
      action: 'signed',
    })

    return successResponse({
      prescriptionId,
      prescriptionNumber,
      qrToken,
      validUntil: validUntilDate,
    })
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Erreur interne', 500, err instanceof Error ? err.message : String(err))
  }
})
