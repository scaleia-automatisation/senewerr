import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Génère des exports CSV de toutes les données de la mutuelle.
// Retourne des chaînes CSV (avec BOM) — le client les télécharge individuellement.
// Aucune donnée médicale sensible n'est exportée (ordonnances, CR médicaux).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const BOM = '﻿'
  const csv = (rows: string[][]): string =>
    BOM + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')

  const [contratsRes, cotisationsRes, rembsRes, tpRes] = await Promise.all([
    admin.from('contrats')
      .select('id, numero_contrat, statut, cotisation_mensuelle, date_adhesion, date_fin, profiles!contrats_adherent_id_fkey(full_name, email)')
      .eq('mutuelle_id', mutuelleId)
      .limit(5000),
    admin.from('cotisations')
      .select('id, mois, montant, statut, mode_paiement, date_paiement, contrat_id')
      .eq('mutuelle_id', mutuelleId)
      .order('mois', { ascending: false })
      .limit(10000),
    admin.from('remboursement_demandes')
      .select('id, numero_demande, type_soin, montant_demande, montant_approuve, statut, created_at, date_remboursement')
      .eq('mutuelle_id', mutuelleId)
      .order('created_at', { ascending: false })
      .limit(5000),
    admin.from('tiers_payant_demandes')
      .select('id, type, montant_mutuelle, statut, created_at')
      .eq('mutuelle_id', mutuelleId)
      .order('created_at', { ascending: false })
      .limit(5000),
  ])

  const contrats = contratsRes.data ?? []
  const cotisations = cotisationsRes.data ?? []
  const rembs = rembsRes.data ?? []
  const tp = tpRes.data ?? []

  const csvAdherents = csv([
    ['N° Contrat', 'Adhérent', 'Email', 'Statut', 'Cotisation mensuelle (FCFA)', 'Date adhésion', 'Date fin'],
    ...contrats.map((c: any) => [
      c.numero_contrat ?? c.id,
      (c.profiles as any)?.full_name ?? '',
      (c.profiles as any)?.email ?? '',
      c.statut ?? '',
      String(c.cotisation_mensuelle ?? 0),
      c.date_adhesion ?? '',
      c.date_fin ?? '',
    ]),
  ])

  const csvCotisations = csv([
    ['ID', 'N° Contrat', 'Mois', 'Montant (FCFA)', 'Statut', 'Mode paiement', 'Date paiement'],
    ...cotisations.map((c: any) => [
      c.id, c.contrat_id ?? '', c.mois ?? '',
      String(c.montant ?? 0), c.statut ?? '', c.mode_paiement ?? '', c.date_paiement ?? '',
    ]),
  ])

  const csvRembs = csv([
    ['N° Demande', 'Type soin', 'Montant demandé (FCFA)', 'Montant approuvé (FCFA)', 'Statut', 'Date création', 'Date remboursement'],
    ...rembs.map((r: any) => [
      r.numero_demande ?? r.id, r.type_soin ?? '', String(r.montant_demande ?? 0),
      String(r.montant_approuve ?? 0), r.statut ?? '', r.created_at?.slice(0, 10) ?? '', r.date_remboursement ?? '',
    ]),
  ])

  const csvTP = csv([
    ['ID', 'Type', 'Montant mutuelle (FCFA)', 'Statut', 'Date création'],
    ...tp.map((t: any) => [
      t.id, t.type ?? '', String(t.montant_mutuelle ?? 0), t.statut ?? '', t.created_at?.slice(0, 10) ?? '',
    ]),
  ])

  return successResponse({
    fichiers: {
      'adherents.csv': csvAdherents,
      'cotisations.csv': csvCotisations,
      'remboursements.csv': csvRembs,
      'tiers_payant.csv': csvTP,
    },
    meta: {
      mutuelle_id: mutuelleId,
      genere_le: new Date().toISOString(),
      nb_adherents: contrats.length,
      nb_cotisations: cotisations.length,
      nb_remboursements: rembs.length,
      nb_tp: tp.length,
    },
  })
})
