import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.4/mod.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  // Accessible par gestionnaire_mutuelle OU le patient lui-même
  const body = await req.json().catch(() => null)
  const { contratId } = body ?? {}
  if (!contratId) return errorResponse('INVALID_BODY', 'contratId requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier accès
  let mutuelleId: string | null = null
  if (auth.role === 'gestionnaire_mutuelle') {
    const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
    mutuelleId = prof?.mutuelle_id ?? null
    if (!mutuelleId) {
      const { data: mg } = await admin.from('mutuelles_gestionnaires')
        .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
      mutuelleId = mg?.mutuelle_id ?? null
    }
  }

  const { data: contrat } = await admin.from('contrats')
    .select(`
      id, numero_contrat, statut, type_couverture, date_debut, date_fin,
      montant_cotisation, nb_beneficiaires, mutuelle_id,
      adherent_id,
      profiles!contrats_adherent_id_fkey(full_name, groupe_sanguin),
      plans_mutuelle!contrats_plan_id_fkey(nom, taux_consultation, taux_pharma, taux_hospit, plafond_annuel),
      mutuelles!contrats_mutuelle_id_fkey(nom, logo_url, telephone)
    `)
    .eq('id', contratId)
    .single()

  if (!contrat) return errorResponse('NOT_FOUND', 'Contrat introuvable', 404)

  // Vérifier accès (gestionnaire de CETTE mutuelle OU l'adhérent lui-même)
  if (auth.role === 'gestionnaire_mutuelle' && contrat.mutuelle_id !== mutuelleId) {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }
  if (auth.role === 'patient' && contrat.adherent_id !== auth.profileId) {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  // Générer JWT signé pour la carte (validité 1 an)
  const secret = Deno.env.get('JWT_CARD_SECRET') ?? 'senewerr-card-secret'
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  const token = await create(
    { alg: 'HS256', typ: 'JWT' },
    {
      sub: contrat.id,
      contrat: contrat.numero_contrat,
      adherent_id: contrat.adherent_id,
      mutuelle_id: contrat.mutuelle_id,
      statut: contrat.statut,
      exp: getNumericDate(365 * 24 * 60 * 60), // 1 an
    },
    key,
  )

  const adherent = (contrat as any).profiles
  const plan = (contrat as any).plans_mutuelle
  const mutuelle = (contrat as any).mutuelles

  return successResponse({
    numeroContrat: contrat.numero_contrat,
    adherentNom: adherent?.full_name ?? '',
    groupeSanguin: adherent?.groupe_sanguin ?? null,
    statutContrat: contrat.statut,
    typeCouverture: contrat.type_couverture,
    dateDebut: contrat.date_debut,
    dateFin: contrat.date_fin,
    planNom: plan?.nom ?? '',
    tauxConsultation: plan?.taux_consultation ?? 0,
    tauxPharma: plan?.taux_pharma ?? 0,
    tauxHostpit: plan?.taux_hospit ?? 0,
    plafondAnnuel: plan?.plafond_annuel ?? 0,
    mutuelleNom: mutuelle?.nom ?? '',
    mutuelleLogo: mutuelle?.logo_url ?? null,
    mutuelleTelephone: mutuelle?.telephone ?? '',
    qrToken: token,
  })
})
