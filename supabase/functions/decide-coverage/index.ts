import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type CoverageAction = 'approved' | 'partially_approved' | 'rejected' | 'info_requested'
const VALID_ACTIONS: CoverageAction[] = ['approved', 'partially_approved', 'rejected', 'info_requested']

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1. Auth — mutual staff
  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) } catch { return errorResponse('UNAUTHORIZED', 'Auth required', 401) }
  if (!['mutual_admin', 'mutual_staff'].includes(auth.role))
    return errorResponse('FORBIDDEN', 'Mutual staff only', 403)

  const body = await req.json().catch(() => null)
  if (!body?.coverageRequestId || !body?.action)
    return errorResponse('BAD_REQUEST', 'coverageRequestId and action are required', 400)

  const { coverageRequestId, action, approvedAmount, reason, message } = body as {
    coverageRequestId: string
    action: CoverageAction
    approvedAmount?: number
    reason?: string
    message?: string
  }

  if (!VALID_ACTIONS.includes(action))
    return errorResponse('INVALID_ACTION', `action must be one of: ${VALID_ACTIONS.join(', ')}`, 400)

  const supabase = db()

  // 2. Fetch coverage_request with reservation info
  const { data: coverage, error: covErr } = await supabase
    .from('coverage_requests')
    .select(`
      id, status, requested_amount, insurance_member_id,
      reservation_id,
      pharmacy_reservations!inner(
        id, pharmacy_id, reservation_number, patient_id, total_amount, insurance_status
      )
    `)
    .eq('id', coverageRequestId)
    .single()

  if (covErr || !coverage) return errorResponse('NOT_FOUND', 'Demande de couverture introuvable', 404)

  // 2b. Verify caller's org includes the insurance member's organization
  const memberId = coverage.insurance_member_id
  const { data: member, error: memberErr } = await supabase
    .from('insurance_members')
    .select('id, profile_id, coverage_end, ceiling_used, ceiling_total, organization_id')
    .eq('id', memberId)
    .single()

  if (memberErr || !member) return errorResponse('MEMBER_NOT_FOUND', 'Membre assuré introuvable', 404)

  if (!auth.orgIds.includes(member.organization_id))
    return errorResponse('FORBIDDEN', 'Cette demande n\'appartient pas à votre organisation', 403)

  // 3. Check coverage validity
  if (member.coverage_end && new Date(member.coverage_end) < new Date())
    return errorResponse('CONTRACT_EXPIRED', 'Contrat de couverture expiré', 422)

  if (!['pending', 'info_requested'].includes(coverage.status))
    return errorResponse('INVALID_STATUS', `Statut actuel: ${coverage.status} — décision déjà prise`, 422)

  const reservation = (coverage as any).pharmacy_reservations
  const now = new Date().toISOString()

  // Handle each action
  if (action === 'approved' || action === 'partially_approved') {
    // 4a. approvedAmount required and must be <= requested_amount
    if (approvedAmount === undefined || approvedAmount < 0)
      return errorResponse('BAD_REQUEST', 'approvedAmount est requis pour une approbation', 400)
    if (approvedAmount > coverage.requested_amount)
      return errorResponse('BAD_REQUEST', `approvedAmount (${approvedAmount}) ne peut pas dépasser le montant demandé (${coverage.requested_amount})`, 400)

    const approved = approvedAmount
    const patientAmount = reservation.total_amount - approved

    // 4b. Update coverage_request
    await supabase.from('coverage_requests').update({
      status: action,
      approved_amount: approved,
      applied_rate: reservation.total_amount > 0 ? approved / reservation.total_amount : 0,
      decided_by: auth.profileId,
      decided_at: now,
    }).eq('id', coverageRequestId)

    // 4c/d. Update pharmacy_reservations
    await supabase.from('pharmacy_reservations').update({
      insurance_amount: approved,
      patient_amount: patientAmount,
      insurance_status: action === 'approved' ? 'approved' : 'partially_approved',
      mutual_payment_status: 'pending',
    }).eq('id', reservation.id)

    // 4e. Update ceiling_used on insurance_members
    await supabase.from('insurance_members').update({
      ceiling_used: (member.ceiling_used ?? 0) + approved,
    }).eq('id', memberId)

    // 4f. Domain event
    await supabase.from('domain_events').insert({
      event_type: 'COVERAGE_APPROVED',
      entity_type: 'coverage_request',
      entity_id: coverageRequestId,
      actor_id: auth.profileId,
      patient_id: reservation.patient_id,
    })

    // 4g. Notify patient
    await supabase.from('notifications').insert({
      recipient_id: reservation.patient_id,
      type: 'COVERAGE_APPROVED',
      title: 'Prise en charge validée',
      body: `Votre mutuelle prend en charge ${approved} FCFA. Reste à payer : ${patientAmount} FCFA`,
      reference_id: reservation.id,
    })

    // 4h. Notify pharmacy staff
    await supabase.from('notifications').insert({
      recipient_role: 'pharmacy_staff',
      organization_id: reservation.pharmacy_id,
      type: 'COVERAGE_VALIDATED',
      title: 'Mutuelle validée',
      body: `Mutuelle validée pour ${reservation.reservation_number} — ${approved} FCFA pris en charge`,
      reference_id: reservation.id,
    })

  } else if (action === 'rejected') {
    // 5a. Update coverage_request
    await supabase.from('coverage_requests').update({
      status: 'rejected',
      decision_reason: reason ?? null,
      decided_by: auth.profileId,
      decided_at: now,
    }).eq('id', coverageRequestId)

    // 5b. Update pharmacy_reservations — full amount back to patient
    await supabase.from('pharmacy_reservations').update({
      insurance_status: 'rejected',
      mutual_payment_status: 'not_required',
      patient_amount: reservation.total_amount,
    }).eq('id', reservation.id)

    // Domain event
    await supabase.from('domain_events').insert({
      event_type: 'COVERAGE_REJECTED',
      entity_type: 'coverage_request',
      entity_id: coverageRequestId,
      actor_id: auth.profileId,
      patient_id: reservation.patient_id,
    })

    // 5c. Notify patient
    await supabase.from('notifications').insert({
      recipient_id: reservation.patient_id,
      type: 'COVERAGE_REJECTED',
      title: 'Prise en charge refusée',
      body: `Prise en charge refusée : ${reason ?? 'Non éligible'}`,
      reference_id: reservation.id,
    })

  } else if (action === 'info_requested') {
    if (!message?.trim())
      return errorResponse('BAD_REQUEST', 'message est requis pour info_requested', 400)

    // 6a. Update coverage_request
    await supabase.from('coverage_requests').update({
      status: 'info_requested',
      info_request_message: message,
    }).eq('id', coverageRequestId)

    // Domain event
    await supabase.from('domain_events').insert({
      event_type: 'COVERAGE_INFO_REQUESTED',
      entity_type: 'coverage_request',
      entity_id: coverageRequestId,
      actor_id: auth.profileId,
    })

    // 6b. Notify patient and pharmacy
    await supabase.from('notifications').insert({
      recipient_id: reservation.patient_id,
      type: 'COVERAGE_INFO_REQUESTED',
      title: 'Information requise',
      body: `Votre mutuelle demande des informations complémentaires : ${message}`,
      reference_id: reservation.id,
    })

    await supabase.from('notifications').insert({
      recipient_role: 'pharmacy_staff',
      organization_id: reservation.pharmacy_id,
      type: 'COVERAGE_INFO_REQUESTED',
      title: 'Informations demandées par la mutuelle',
      body: `La mutuelle demande des informations pour ${reservation.reservation_number}`,
      reference_id: reservation.id,
    })
  }

  return successResponse({ message: 'Décision de couverture enregistrée', action })
})
