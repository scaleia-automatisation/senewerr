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

  if (auth.role !== 'professional') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const profId = auth.profileId

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString()

  const [
    tarif,
    apptsTodayAll,
    pendingReqs,
    consultMois,
    consultPrevMois,
    prescMois,
  ] = await Promise.all([
    // Tarif de consultation du praticien
    admin.from('professionals').select('consultation_fee').eq('profile_id', profId).maybeSingle(),

    // Tous les RDV du jour (pour calcul patients vus + restants + durée moy)
    admin.from('appointments')
      .select('id, status, started_at, ended_at, duration_minutes')
      .eq('professional_id', profId)
      .gte('starts_at', todayStart)
      .lte('starts_at', todayEnd)
      .not('status', 'in', '(cancelled_patient,cancelled_professional)'),

    // Nouvelles demandes RDV en attente de confirmation
    admin.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', profId)
      .eq('status', 'pending'),

    // Consultations ce mois
    admin.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', profId)
      .in('status', ['completed', 'in_consultation'])
      .gte('starts_at', monthStart)
      .lte('starts_at', monthEnd),

    // Consultations mois précédent
    admin.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', profId)
      .in('status', ['completed', 'in_consultation'])
      .gte('starts_at', prevMonthStart)
      .lte('starts_at', prevMonthEnd),

    // Ordonnances ce mois
    admin.from('prescriptions')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', profId)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd),
  ])

  const fee = tarif.data?.consultation_fee ?? 0
  const appts = apptsTodayAll.data ?? []

  const patients_vus = appts.filter(a => a.status === 'completed' || a.status === 'in_consultation').length
  const patients_restants = appts.filter(a =>
    a.status === 'pending' || a.status === 'confirmed' || a.status === 'patient_arrived'
  ).length

  // Durée moyenne (consultations terminées avec durée connue)
  const completed = appts.filter(a => a.status === 'completed' && a.duration_minutes)
  const duree_moy = completed.length > 0
    ? Math.round(completed.reduce((s: number, a: any) => s + (a.duration_minutes ?? 0), 0) / completed.length)
    : null

  const revenus_jour   = patients_vus * fee
  const revenus_mois   = (consultMois.count ?? 0) * fee

  return successResponse({
    patients_vus,
    patients_restants,
    duree_moy,
    revenus_jour,
    nouvelles_demandes: pendingReqs.count ?? 0,
    consultations_mois: consultMois.count ?? 0,
    consultations_mois_prec: consultPrevMois.count ?? 0,
    revenus_mois,
    ordonnances_mois: prescMois.count ?? 0,
  })
})
