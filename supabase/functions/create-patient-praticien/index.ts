import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body: { prenom, nom, date_naissance, sexe, telephone, email?,
//         groupe_sanguin?, allergies?: string[], pathologies_chroniques?: string[] }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { prenom, nom, date_naissance, sexe, telephone, email,
          groupe_sanguin, allergies, pathologies_chroniques } = body ?? {}

  if (!prenom || !nom || !date_naissance || !sexe || !telephone) {
    return errorResponse('INVALID_BODY', 'prenom, nom, date_naissance, sexe, telephone requis', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const full_name = `${prenom} ${nom}`.trim()

  // Check if a patient profile with this phone number already exists
  const { data: existing } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .eq('telephone', telephone)
    .eq('role', 'patient')
    .maybeSingle()

  let patientProfileId: string

  if (existing) {
    patientProfileId = existing.id
  } else {
    // Create auth user with phone (invite flow — no password set yet)
    const { data: newUser, error: userErr } = await admin.auth.admin.createUser({
      phone: telephone,
      phone_confirm: true,
      email: email ?? undefined,
      user_metadata: { full_name, role: 'patient' },
    })
    if (userErr || !newUser.user) {
      return errorResponse('USER_CREATE_FAILED', userErr?.message ?? 'Erreur création compte', 500)
    }

    // Create profile
    const { data: newProfile, error: profErr } = await admin
      .from('profiles')
      .insert({
        user_id: newUser.user.id,
        full_name,
        role: 'patient',
        telephone,
        email: email ?? null,
        date_naissance,
        sexe,
      })
      .select('id')
      .single()

    if (profErr || !newProfile) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(newUser.user.id).catch(() => {})
      return errorResponse('PROFILE_CREATE_FAILED', profErr?.message ?? 'Erreur création profil', 500)
    }

    patientProfileId = newProfile.id
  }

  // Create or update medical summary (dossier_medical)
  if (groupe_sanguin || (allergies?.length) || (pathologies_chroniques?.length)) {
    await admin.from('dossiers_medicaux').upsert({
      patient_id: patientProfileId,
      groupe_sanguin: groupe_sanguin ?? null,
      allergies: allergies ?? [],
      pathologies_chroniques: pathologies_chroniques ?? [],
    }, { onConflict: 'patient_id' })
  }

  // Create praticien_patients relation (ignore if already exists)
  const { error: relErr } = await admin
    .from('praticien_patients')
    .upsert({
      praticien_id: auth.profileId,
      patient_id:   patientProfileId,
      actif: true,
      created_at: new Date().toISOString(),
    }, { onConflict: 'praticien_id,patient_id' })

  if (relErr) return errorResponse('RELATION_FAILED', relErr.message, 500)

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    target_id:  patientProfileId,
    action:     'patient_added',
    table_name: 'praticien_patients',
    metadata:   { is_new_account: !existing },
  }).catch(() => {})

  // Send invitation SMS if new account
  if (!existing) {
    const smsBody = `Bonjour ${prenom}, votre médecin vous a inscrit sur Séne Wérr. Téléchargez l'application pour accéder à vos soins : https://senewrr.sn`
    await admin.from('sms_queue').insert({
      to:      telephone,
      message: smsBody,
      status:  'pending',
    }).catch(() => {})
  }

  return successResponse({
    ok: true,
    patient_id: patientProfileId,
    is_new: !existing,
  })
})
