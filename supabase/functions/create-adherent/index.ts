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

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const {
    prenom, nom, date_naissance, numero_identite, telephone, email, adresse,
    groupe_sanguin, type_couverture, nb_beneficiaires, plan_id, date_debut,
  } = body ?? {}

  if (!prenom || !nom || !telephone || !plan_id || !date_debut) {
    return errorResponse('INVALID_BODY', 'Champs obligatoires manquants', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Récupérer mutuelle_id du gestionnaire
  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  // Vérifier que le plan appartient à cette mutuelle
  const { data: plan } = await admin.from('plans_mutuelle')
    .select('id, nom, montant_cotisation').eq('id', plan_id).eq('mutuelle_id', mutuelleId).single()
  if (!plan) return errorResponse('NOT_FOUND', 'Plan introuvable', 404)

  // Générer N° contrat anti-collision MW-YYYYMM-XXXXX
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  let numeroContrat = ''
  let attempts = 0
  while (attempts < 10) {
    const seq = String(Math.floor(Math.random() * 99999 + 1)).padStart(5, '0')
    const candidate = `MW-${yyyymm}-${seq}`
    const { count } = await admin.from('contrats').select('*', { count: 'exact', head: true }).eq('numero_contrat', candidate)
    if (!count) { numeroContrat = candidate; break }
    attempts++
  }
  if (!numeroContrat) return errorResponse('CONFLICT', 'Impossible de générer un N° contrat unique', 500)

  // Créer ou récupérer un compte Supabase auth pour le patient
  // On crée d'abord le profil patient
  const { data: existingProfile } = await admin.from('profiles')
    .select('id').eq('telephone', telephone).single()

  let patientProfileId: string
  if (existingProfile?.id) {
    patientProfileId = existingProfile.id
  } else {
    // Créer un profil sans compte auth (gestionnaire inscrit pour le patient)
    const { data: newProfile, error: profileErr } = await admin.from('profiles').insert({
      full_name: `${prenom} ${nom}`,
      telephone,
      email: email ?? null,
      role: 'patient',
      mutuelle_id: mutuelleId,
      date_naissance: date_naissance ?? null,
      numero_identite: numero_identite ?? null,
      adresse: adresse ?? null,
      groupe_sanguin: groupe_sanguin ?? null,
    }).select('id').single()
    if (profileErr || !newProfile) {
      return errorResponse('DB_ERROR', 'Erreur création profil: ' + profileErr?.message, 500)
    }
    patientProfileId = newProfile.id
  }

  // Calculer date de fin (1 an par défaut)
  const dateDebut = new Date(date_debut)
  const dateFin = new Date(dateDebut)
  dateFin.setFullYear(dateFin.getFullYear() + 1)

  // Créer le contrat
  const { data: contrat, error: contratErr } = await admin.from('contrats').insert({
    mutuelle_id: mutuelleId,
    adherent_id: patientProfileId,
    plan_id,
    numero_contrat: numeroContrat,
    statut: 'ACTIF',
    type_couverture: type_couverture ?? 'individuel',
    nb_beneficiaires: nb_beneficiaires ?? 1,
    montant_cotisation: plan.montant_cotisation ?? 0,
    date_debut: date_debut,
    date_fin: dateFin.toISOString().split('T')[0],
  }).select('id, numero_contrat').single()

  if (contratErr || !contrat) {
    return errorResponse('DB_ERROR', 'Erreur création contrat: ' + contratErr?.message, 500)
  }

  // Envoyer notification de bienvenue
  await admin.from('notifications').insert({
    profile_id: patientProfileId,
    type: 'bienvenue_mutuelle',
    titre: 'Bienvenue dans votre mutuelle',
    message: `Votre contrat ${numeroContrat} a été créé. Vous bénéficiez désormais de la couverture ${plan.nom}.`,
    urgence: 'normal',
    mutuelle_id: mutuelleId,
  })

  return successResponse({
    contratId: contrat.id,
    numeroContrat: contrat.numero_contrat,
    adherentProfileId: patientProfileId,
  })
})
