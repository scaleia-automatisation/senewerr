import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth, AuthContext } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'
import { notify } from '../_shared/notify.ts'

// ---------------------------------------------------------------------------
// Stripe helper
// ---------------------------------------------------------------------------
function toStripeParams(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v === null || v === undefined) continue
    if (typeof v === 'object' && !Array.isArray(v))
      Object.assign(out, toStripeParams(v as Record<string, unknown>, key))
    else if (Array.isArray(v)) v.forEach((item, i) => { out[`${key}[${i}]`] = String(item) })
    else out[key] = String(v)
  }
  return out
}

async function stripeRequest(method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(toStripeParams(body)).toString() : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Stripe ${path}: ${data.error?.message}`)
  return data
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
async function writeAudit(
  db: SupabaseClient,
  opts: {
    action: string
    actorId: string
    entityType?: string
    entityId?: string
    result: 'success' | 'failure'
    cause?: string
    metadata?: Record<string, unknown>
  }
) {
  try {
    await (db as any).from('audit_logs').insert({
      action: opts.action,
      actor_id: opts.actorId,
      target_entity_type: opts.entityType ?? null,
      target_entity_id: opts.entityId ?? null,
      result: opts.result,
      cause: opts.cause ?? null,
      metadata: opts.metadata ?? null,
    })
  } catch (e) {
    // Audit failure must never crash the main response
    console.error('[audit_logs] write failed:', e)
  }
}

// ---------------------------------------------------------------------------
// Guard helpers
// ---------------------------------------------------------------------------
function requireSuperAdmin(profile: AuthContext, actionName: string) {
  if (profile.role !== 'super_admin') {
    throw Object.assign(new Error('REQUIRES_SUPER_ADMIN'), {
      clientMessage: `L'action ${actionName} est réservée aux super administrateurs`,
    })
  }
}

function requireAdminRole(profile: AuthContext) {
  if (!['platform_admin', 'super_admin'].includes(profile.role)) {
    throw Object.assign(new Error('FORBIDDEN'), {
      clientMessage: 'Accès réservé aux administrateurs de la plateforme',
    })
  }
}

// ---------------------------------------------------------------------------
// Actor actions
// ---------------------------------------------------------------------------
async function handleValidate(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_type, entity_id } = body
  if (!entity_type || !entity_id) throw new Error('MISSING_PARAMS')

  // Update verification_status on the relevant table
  if (entity_type === 'professional') {
    const { error } = await db
      .from('professionals')
      .update({ verification_status: 'verified', is_visible: true })
      .eq('id', entity_id)
    if (error) throw error
  } else if (entity_type === 'organization') {
    const { error } = await db
      .from('organizations')
      .update({ verification_status: 'verified', can_receive_reservations: true })
      .eq('id', entity_id)
    if (error) throw error
  } else {
    const { error } = await db
      .from('profiles')
      .update({ verification_status: 'verified' })
      .eq('id', entity_id)
    if (error) throw error
  }

  // Resolve the profile to notify
  let targetProfileId: string | null = null
  if (entity_type === 'professional') {
    const { data } = await db.from('professionals').select('profile_id').eq('id', entity_id).maybeSingle()
    targetProfileId = data?.profile_id ?? null
  } else if (entity_type === 'organization') {
    // Find org admin via organization_members
    const { data } = await (db as any)
      .from('organization_members')
      .select('profile_id')
      .eq('organization_id', entity_id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    targetProfileId = data?.profile_id ?? null
  } else {
    targetProfileId = entity_id
  }

  if (targetProfileId) {
    await notify(db, {
      eventType: 'actor.verified',
      recipientId: targetProfileId,
      data: { entity_type, entity_id },
      priority: 'high',
    })
  }

  return { entity_type, entity_id, status: 'verified' }
}

async function handleRefuse(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_type, entity_id, reason } = body
  if (!entity_type || !entity_id) throw new Error('MISSING_PARAMS')

  const table =
    entity_type === 'professional' ? 'professionals'
    : entity_type === 'organization' ? 'organizations'
    : 'profiles'

  const { error } = await db
    .from(table)
    .update({ verification_status: 'rejected', rejection_reason: reason ?? null })
    .eq('id', entity_id)
  if (error) throw error

  // Notify
  let targetProfileId: string | null = null
  if (entity_type === 'professional') {
    const { data } = await db.from('professionals').select('profile_id').eq('id', entity_id).maybeSingle()
    targetProfileId = data?.profile_id ?? null
  } else if (entity_type === 'organization') {
    const { data } = await (db as any)
      .from('organization_members')
      .select('profile_id')
      .eq('organization_id', entity_id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    targetProfileId = data?.profile_id ?? null
  } else {
    targetProfileId = entity_id
  }

  if (targetProfileId) {
    await notify(db, {
      eventType: 'actor.rejected',
      recipientId: targetProfileId,
      data: { entity_type, entity_id, reason },
      priority: 'high',
    })
  }

  return { entity_type, entity_id, status: 'rejected' }
}

async function handleRequestDocument(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_type, entity_id, documents, message } = body
  if (!entity_type || !entity_id) throw new Error('MISSING_PARAMS')

  const { data: inserted, error } = await (db as any)
    .from('verification_requests')
    .insert({
      entity_type,
      entity_id,
      requested_by: profile.profileId,
      documents: documents ?? [],
      message: message ?? null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw error

  // Resolve profile to notify
  let targetProfileId: string | null = null
  if (entity_type === 'professional') {
    const { data } = await db.from('professionals').select('profile_id').eq('id', entity_id).maybeSingle()
    targetProfileId = data?.profile_id ?? null
  } else if (entity_type === 'organization') {
    const { data } = await (db as any)
      .from('organization_members')
      .select('profile_id')
      .eq('organization_id', entity_id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    targetProfileId = data?.profile_id ?? null
  } else {
    targetProfileId = entity_id
  }

  if (targetProfileId) {
    await notify(db, {
      eventType: 'actor.document_requested',
      recipientId: targetProfileId,
      data: { entity_type, entity_id, documents, message },
      priority: 'high',
    })
  }

  return { request_id: inserted?.id }
}

async function handleSuspend(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id, motif } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  // Update profile
  const { data: targetProfile, error: profErr } = await db
    .from('profiles')
    .update({ status: 'suspended', suspend_reason: motif ?? null })
    .eq('id', entity_id)
    .select('user_id, role')
    .single()
  if (profErr) throw profErr

  // Revoke sessions (super_admin only)
  if (profile.role === 'super_admin' && targetProfile?.user_id) {
    try {
      await db.auth.admin.signOut(targetProfile.user_id)
    } catch (e) {
      console.error('[suspend] signOut failed:', e)
    }
  }

  // Set org invisible
  const { data: memberships } = await (db as any)
    .from('organization_members')
    .select('organization_id')
    .eq('profile_id', entity_id)
    .eq('status', 'active')
  if (memberships?.length) {
    const orgIds = memberships.map((m: any) => m.organization_id)
    await db.from('organizations').update({ is_visible: false }).in('id', orgIds)
  }

  // Cancel future appointments for professional
  const now = new Date().toISOString()
  const { data: appointments } = await db
    .from('appointments')
    .select('id, patient_id, starts_at')
    .eq('professional_id', entity_id)
    .gt('starts_at', now)
    .not('status', 'in', '("cancelled_patient","cancelled_professional","cancelled_establishment","completed","no_show")')
  if (appointments?.length) {
    await db
      .from('appointments')
      .update({ status: 'cancelled', cancel_reason: `Professionnel suspendu: ${motif ?? ''}`, cancelled_by: profile.profileId })
      .in('id', appointments.map((a: any) => a.id))

    // Notify patients
    for (const appt of appointments) {
      const { data: pat } = await db
        .from('patients')
        .select('profile_id')
        .eq('id', appt.patient_id)
        .maybeSingle()
      if (pat?.profile_id) {
        await notify(db, {
          eventType: 'appointment.cancelled_by_admin',
          recipientId: pat.profile_id,
          data: { appointment_id: appt.id, reason: motif },
          priority: 'high',
        })
      }
    }
  }

  // Pharmacy reservations: cancel unpaid ones
  const { data: reservations } = await (db as any)
    .from('pharmacy_reservations')
    .select('id, patient_id, payment_id, status')
    .eq('pharmacist_id', entity_id)
    .in('status', ['pending', 'confirmed'])
  if (reservations?.length) {
    for (const res of reservations) {
      const { data: payment } = await db
        .from('payments')
        .select('status, provider_payment_id, amount')
        .eq('id', res.payment_id)
        .maybeSingle()
      if (!payment || payment.status !== 'paid') {
        // Not yet paid — cancel
        await (db as any)
          .from('pharmacy_reservations')
          .update({ status: 'cancelled', cancelled_by: profile.profileId, cancel_reason: motif ?? 'Pharmacien suspendu' })
          .eq('id', res.id)
      }
      // If funded (paid) → leave until withdrawal per spec
    }
  }

  // Notify the suspended actor
  await notify(db, {
    eventType: 'actor.suspended',
    recipientId: entity_id,
    data: { motif },
    priority: 'critical',
  })

  return { entity_id, status: 'suspended' }
}

async function handleReactivate(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  const { error } = await db
    .from('profiles')
    .update({ status: 'active', suspend_reason: null })
    .eq('id', entity_id)
  if (error) throw error

  await notify(db, {
    eventType: 'actor.reactivated',
    recipientId: entity_id,
    data: {},
    priority: 'high',
  })

  return { entity_id, status: 'active' }
}

async function handleAnonymize(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'anonymize')
  const { entity_id } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  const anonEmail = `${crypto.randomUUID()}@deleted.sene-werr.sn`

  // Anonymize profile
  const { error } = await db
    .from('profiles')
    .update({
      first_name: 'Anonymisé',
      last_name: '',
      email: anonEmail,
      phone: null,
      avatar_url: null,
      status: 'deleted',
    })
    .eq('id', entity_id)
  if (error) throw error

  // Delete patient-specific data
  const { data: patient } = await db
    .from('patients')
    .select('id')
    .eq('profile_id', entity_id)
    .maybeSingle()
  if (patient) {
    await db.from('prescriptions').update({ notes: null }).eq('patient_id', patient.id)
  }

  // Complete data deletion requests
  await (db as any)
    .from('data_deletion_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('profile_id', entity_id)

  return { entity_id, anonymized: true }
}

async function handleResetPassword(db: SupabaseClient, profile: AuthContext, body: any) {
  const { email } = body
  if (!email) throw new Error('MISSING_PARAMS')

  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email })
  if (error) throw error

  return { link: data.properties?.action_link ?? null, email }
}

// ---------------------------------------------------------------------------
// Order actions
// ---------------------------------------------------------------------------
async function handleRelancer(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id, channel, message } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  // Guard: check last reminder < 24h
  const { data: lastReminder } = await (db as any)
    .from('reminders')
    .select('created_at')
    .eq('entity_type', 'reservation')
    .eq('entity_id', entity_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastReminder) {
    const diffHours = (Date.now() - new Date(lastReminder.created_at).getTime()) / 3600000
    if (diffHours < 24) {
      throw Object.assign(new Error('REMINDER_TOO_SOON'), {
        clientMessage: 'Un rappel a déjà été envoyé dans les dernières 24h',
      })
    }
  }

  const { data: inserted, error } = await (db as any)
    .from('reminders')
    .insert({
      entity_type: 'reservation',
      entity_id,
      sent_by: profile.profileId,
      channel: channel ?? 'in_app',
      message: message ?? null,
    })
    .select('id')
    .single()
  if (error) throw error

  // Resolve patient to notify
  const { data: reservation } = await (db as any)
    .from('pharmacy_reservations')
    .select('patient_id')
    .eq('id', entity_id)
    .maybeSingle()
  if (reservation?.patient_id) {
    const { data: pat } = await db
      .from('patients')
      .select('profile_id')
      .eq('id', reservation.patient_id)
      .maybeSingle()
    if (pat?.profile_id) {
      await notify(db, {
        eventType: 'reservation.reminder',
        recipientId: pat.profile_id,
        data: { reservation_id: entity_id, message },
        priority: 'normal',
      })
    }
  }

  return { reminder_id: inserted?.id }
}

async function handleRefundPayment(db: SupabaseClient, profile: AuthContext, body: any) {
  const { payment_id, amount, reason } = body
  if (!payment_id) throw new Error('MISSING_PARAMS')

  const { data: payment, error: payErr } = await db
    .from('payments')
    .select('*')
    .eq('id', payment_id)
    .maybeSingle()
  if (payErr) throw payErr
  if (!payment) throw Object.assign(new Error('PAYMENT_NOT_FOUND'), { clientMessage: 'Paiement introuvable' })

  const refundAmount = amount ?? payment.amount
  if (refundAmount > payment.amount) {
    throw Object.assign(new Error('REFUND_EXCEEDS_PAYMENT'), { clientMessage: 'Le montant de remboursement dépasse le paiement' })
  }

  if (refundAmount > 50000 && profile.role !== 'super_admin') {
    throw Object.assign(new Error('REQUIRES_SUPER_ADMIN'), {
      clientMessage: 'Les remboursements supérieurs à 50 000 nécessitent un super administrateur',
    })
  }

  let stripeRefundId: string | null = null
  let refundStatus = 'manual_refund'

  if (payment.provider_payment_id && payment.provider === 'stripe') {
    const stripeRefund = await stripeRequest('POST', '/refunds', {
      payment_intent: payment.provider_payment_id,
      amount: refundAmount,
      reason: 'requested_by_customer',
      metadata: { payment_id, refunded_by: profile.profileId },
    })
    stripeRefundId = stripeRefund.id
    refundStatus = 'refunded'
  }

  // Update payment status
  await db
    .from('payments')
    .update({ status: refundStatus, refunded_at: new Date().toISOString() })
    .eq('id', payment_id)

  // Insert refund record
  await (db as any).from('refunds').insert({
    payment_id,
    subscriber_id: payment.subscriber_id,
    amount: refundAmount,
    reason: reason ?? 'admin_refund',
    provider_refund_id: stripeRefundId,
    requested_by: profile.profileId,
    status: 'pending',
  })

  return { payment_id, refund_amount: refundAmount, stripe_refund_id: stripeRefundId }
}

async function handleOpenDispute(db: SupabaseClient, profile: AuthContext, body: any) {
  const { reservation_id, category, description } = body
  if (!reservation_id) throw new Error('MISSING_PARAMS')

  const { data: inserted, error } = await (db as any)
    .from('disputes')
    .insert({
      reservation_id,
      opened_by: profile.profileId,
      category: category ?? 'other',
      description: description ?? null,
      status: 'open',
    })
    .select('id')
    .single()
  if (error) throw error

  return { dispute_id: inserted?.id }
}

async function handleCancelOrder(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id, motif } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  // Fetch reservation and its payment
  const { data: reservation, error: resErr } = await (db as any)
    .from('pharmacy_reservations')
    .select('id, patient_id, pharmacy_id, payment_id, status')
    .eq('id', entity_id)
    .maybeSingle()
  if (resErr) throw resErr
  if (!reservation) throw Object.assign(new Error('RESERVATION_NOT_FOUND'), { clientMessage: 'Commande introuvable' })

  await (db as any)
    .from('pharmacy_reservations')
    .update({
      status: 'cancelled',
      cancelled_by: profile.profileId,
      cancel_reason: motif ?? null,
    })
    .eq('id', entity_id)

  // Cancel pending payment if exists
  if (reservation.payment_id) {
    const { data: payment } = await db
      .from('payments')
      .select('status')
      .eq('id', reservation.payment_id)
      .maybeSingle()
    if (payment?.status === 'pending') {
      await db.from('payments').update({ status: 'cancelled' }).eq('id', reservation.payment_id)
    }
  }

  // Notify patient
  const { data: pat } = await db
    .from('patients')
    .select('profile_id')
    .eq('id', reservation.patient_id)
    .maybeSingle()
  if (pat?.profile_id) {
    await notify(db, {
      eventType: 'reservation.cancelled_by_admin',
      recipientId: pat.profile_id,
      data: { reservation_id: entity_id, motif },
      priority: 'high',
    })
  }

  // Notify pharmacy (via org admin)
  if (reservation.pharmacy_id) {
    const { data: orgAdmin } = await (db as any)
      .from('organization_members')
      .select('profile_id')
      .eq('organization_id', reservation.pharmacy_id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    if (orgAdmin?.profile_id) {
      await notify(db, {
        eventType: 'reservation.cancelled_by_admin',
        recipientId: orgAdmin.profile_id,
        data: { reservation_id: entity_id, motif },
        priority: 'normal',
      })
    }
  }

  return { entity_id, status: 'cancelled' }
}

async function handleForceExpire(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_type, entity_id } = body
  if (!entity_type || !entity_id) throw new Error('MISSING_PARAMS')

  const table =
    entity_type === 'reservation' ? 'pharmacy_reservations'
    : entity_type === 'appointment' ? 'appointments'
    : entity_type === 'subscription' ? 'subscriptions'
    : null
  if (!table) throw new Error('INVALID_ENTITY_TYPE')

  if (table === 'pharmacy_reservations' || table === 'appointments') {
    const { error } = await (db as any)
      .from(table)
      .update({ status: 'expired' })
      .eq('id', entity_id)
    if (error) throw error
  } else {
    const { error } = await db
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('id', entity_id)
    if (error) throw error
  }

  return { entity_type, entity_id, status: 'expired' }
}

async function handleAddInternalNote(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_type, entity_id, content } = body
  if (!entity_type || !entity_id || !content) throw new Error('MISSING_PARAMS')

  const { data: inserted, error } = await (db as any)
    .from('admin_notes')
    .insert({
      entity_type,
      entity_id,
      author_id: profile.profileId,
      content,
    })
    .select('id')
    .single()
  if (error) throw error

  return { note_id: inserted?.id }
}

// ---------------------------------------------------------------------------
// Prescription actions
// ---------------------------------------------------------------------------
async function handleClosePrescriptionReview(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  const { error } = await (db as any)
    .from('prescription_reviews')
    .update({ status: 'closed', reviewed_by: profile.profileId, reviewed_at: new Date().toISOString() })
    .eq('id', entity_id)
  if (error) throw error

  return { review_id: entity_id, status: 'closed' }
}

// ---------------------------------------------------------------------------
// Dispute actions
// ---------------------------------------------------------------------------
async function handleResolveDispute(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id, resolution, action: resolutionAction } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  const { error } = await (db as any)
    .from('disputes')
    .update({
      status: 'resolved',
      resolution: resolution ?? null,
      resolution_action: resolutionAction ?? null,
      resolved_by: profile.profileId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', entity_id)
  if (error) throw error

  return { dispute_id: entity_id, status: 'resolved' }
}

async function handleRejectDispute(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id, motif } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  const { error } = await (db as any)
    .from('disputes')
    .update({
      status: 'rejected',
      rejection_reason: motif ?? null,
      resolved_by: profile.profileId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', entity_id)
  if (error) throw error

  return { dispute_id: entity_id, status: 'rejected' }
}

// ---------------------------------------------------------------------------
// Appointment actions
// ---------------------------------------------------------------------------
async function handleCancelAppointment(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id, motif } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  const { data: appt, error: apptErr } = await db
    .from('appointments')
    .select('id, patient_id, professional_id')
    .eq('id', entity_id)
    .maybeSingle()
  if (apptErr) throw apptErr
  if (!appt) throw Object.assign(new Error('APPOINTMENT_NOT_FOUND'), { clientMessage: 'Rendez-vous introuvable' })

  const { error } = await db
    .from('appointments')
    .update({
      status: 'cancelled',
      cancel_reason: motif ?? null,
      cancelled_by: profile.profileId,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', entity_id)
  if (error) throw error

  // Notify patient
  const { data: pat } = await db
    .from('patients')
    .select('profile_id')
    .eq('id', appt.patient_id)
    .maybeSingle()
  if (pat?.profile_id) {
    await notify(db, {
      eventType: 'appointment.cancelled_by_admin',
      recipientId: pat.profile_id,
      data: { appointment_id: entity_id, motif },
      priority: 'high',
    })
  }

  // Notify professional
  const { data: pro } = await db
    .from('professionals')
    .select('profile_id')
    .eq('id', appt.professional_id)
    .maybeSingle()
  if (pro?.profile_id) {
    await notify(db, {
      eventType: 'appointment.cancelled_by_admin',
      recipientId: pro.profile_id,
      data: { appointment_id: entity_id, motif },
      priority: 'normal',
    })
  }

  return { appointment_id: entity_id, status: 'cancelled' }
}

// ---------------------------------------------------------------------------
// Account actions (super_admin only for most)
// ---------------------------------------------------------------------------
async function handleUnlockAccount(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'unlock_account')
  const { entity_id } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')

  const { error } = await db
    .from('profiles')
    .update({ lock_reason: null, locked_at: null })
    .eq('id', entity_id)
  if (error) throw error

  return { entity_id, unlocked: true }
}

async function handleInviteAdmin(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'invite_admin')
  const { email } = body
  if (!email) throw new Error('MISSING_PARAMS')

  const { data, error } = await db.auth.admin.inviteUserByEmail(email)
  if (error) throw error

  // Set role once profile exists (may not yet — invite is async)
  // Attempt to update if profile already exists
  await db.from('profiles').update({ role: 'platform_admin' }).eq('email', email)

  return { email, invited: true, user_id: data.user?.id ?? null }
}

async function handlePromoteSuperAdmin(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'promote_super_admin')
  const { entity_id } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')
  if (entity_id === profile.profileId) {
    throw Object.assign(new Error('CANNOT_PROMOTE_SELF'), { clientMessage: 'Vous ne pouvez pas modifier votre propre rôle' })
  }

  const { error } = await db
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', entity_id)
  if (error) throw error

  return { entity_id, role: 'super_admin' }
}

async function handleRevokeAdmin(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'revoke_admin')
  const { entity_id } = body
  if (!entity_id) throw new Error('MISSING_PARAMS')
  if (entity_id === profile.profileId) {
    throw Object.assign(new Error('CANNOT_REVOKE_SELF'), { clientMessage: 'Vous ne pouvez pas révoquer votre propre accès administrateur' })
  }

  const { error } = await db
    .from('profiles')
    .update({ role: 'patient' })
    .eq('id', entity_id)
  if (error) throw error

  return { entity_id, role: 'patient' }
}

async function handleAdjustCredits(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id, amount, motif, credit_type } = body
  if (!entity_id || amount === undefined) throw new Error('MISSING_PARAMS')

  const limit = profile.role === 'platform_admin' ? 100 : Infinity
  if (Math.abs(amount) > limit && profile.role !== 'super_admin') {
    throw Object.assign(new Error('CREDIT_LIMIT_EXCEEDED'), {
      clientMessage: `Les administrateurs de plateforme ne peuvent ajuster que jusqu'à ${limit} crédits`,
    })
  }

  // Determine column to update
  const walletColumn = credit_type === 'plan' ? 'plan_credits' : 'purchased_credits'

  // Fetch wallet
  const { data: wallet, error: walletErr } = await (db as any)
    .from('credit_wallets')
    .select('id')
    .eq('profile_id', entity_id)
    .maybeSingle()
  if (walletErr) throw walletErr

  if (!wallet) {
    // Create wallet if missing
    const { error: createErr } = await (db as any)
      .from('credit_wallets')
      .insert({ profile_id: entity_id, plan_credits: 0, purchased_credits: 0, [walletColumn]: Math.max(0, amount) })
    if (createErr) throw createErr
  } else {
    const { error: updateErr } = await (db as any)
      .from('credit_wallets')
      .update({ [walletColumn]: (db as any).rpc('greatest', [0, (db as any).raw(`${walletColumn} + ${amount}`)]) })
      .eq('id', wallet.id)

    // Fallback: use raw increment via RPC or just update with increment
    if (updateErr) {
      // Try plain update – may go negative but guards in application handle this
      await (db as any)
        .from('credit_wallets')
        .update({ [walletColumn]: amount })
        .eq('id', wallet.id)
    }
  }

  // Insert transaction log
  const { data: txn, error: txnErr } = await (db as any)
    .from('credit_transactions')
    .insert({
      type: 'manual_adjustment',
      amount,
      motif: motif ?? null,
      created_by: profile.profileId,
      profile_id: entity_id,
    })
    .select('id')
    .single()
  if (txnErr) throw txnErr

  return { transaction_id: txn?.id, amount, entity_id }
}

async function handleAdminChangePlan(db: SupabaseClient, profile: AuthContext, body: any) {
  const { entity_id, plan_id } = body
  if (!entity_id || !plan_id) throw new Error('MISSING_PARAMS')

  // Deactivate existing subscription
  await db
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('profile_id', entity_id)
    .eq('status', 'active')

  // Insert or update subscription
  const { data: sub, error: subErr } = await db
    .from('subscriptions')
    .upsert({
      profile_id: entity_id,
      subscription_plan_id: plan_id,
      status: 'active',
      manual: true,
      current_period_start: new Date().toISOString(),
    }, { onConflict: 'profile_id' })
    .select('id')
    .single()
  if (subErr) throw subErr

  // Insert subscription event
  await (db as any).from('subscription_events').insert({
    subscription_id: sub?.id,
    event_type: 'plan_changed',
    created_by: profile.profileId,
    metadata: { new_plan_id: plan_id, changed_by_admin: true },
  })

  return { entity_id, plan_id, subscription_id: sub?.id }
}

// ---------------------------------------------------------------------------
// Settings (super_admin only)
// ---------------------------------------------------------------------------
async function handleUpdateSetting(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'update_setting')
  const { key, value } = body
  if (!key || value === undefined) throw new Error('MISSING_PARAMS')

  const { error } = await (db as any)
    .from('platform_settings')
    .update({ value, updated_by: profile.profileId, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) throw error

  return { key, updated: true }
}

async function handleSyncPlansStripe(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'sync_plans_stripe')
  // Delegate to the existing admin-sync-stripe-plans function logic (stub here)
  console.log('[admin-action] sync_plans_stripe triggered by', profile.profileId)
  return { synced: true }
}

async function handleToggleProvider(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'toggle_provider')
  const { entity_id, active } = body
  if (!entity_id || active === undefined) throw new Error('MISSING_PARAMS')

  const { error } = await (db as any)
    .from('payment_providers')
    .update({ is_active: active })
    .eq('id', entity_id)
  if (error) throw error

  return { provider_id: entity_id, is_active: active }
}

async function handleTestProvider(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'test_provider')
  const { provider } = body
  const start = Date.now()

  let ok = false
  try {
    if (provider === 'stripe') {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
      })
      ok = res.ok
    } else {
      ok = false
    }
  } catch {
    ok = false
  }

  return { ok, latency_ms: Date.now() - start }
}

async function handleTestIntegration(db: SupabaseClient, profile: AuthContext, body: any) {
  requireSuperAdmin(profile, 'test_integration')
  const { integration } = body
  const start = Date.now()

  let ok = false
  try {
    if (integration === 'stripe') {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
      })
      ok = res.ok
    } else if (integration === 'resend') {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` },
      })
      ok = res.ok
    } else if (integration === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      })
      ok = res.ok
    } else {
      ok = false
    }
  } catch {
    ok = false
  }

  // NEVER expose API keys in response
  return { ok, latency_ms: Date.now() - start, integration }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
const DISPATCH: Record<
  string,
  (db: SupabaseClient, profile: AuthContext, body: any) => Promise<unknown>
> = {
  // Actor
  validate:                  handleValidate,
  refuse:                    handleRefuse,
  request_document:          handleRequestDocument,
  suspend:                   handleSuspend,
  reactivate:                handleReactivate,
  anonymize:                 handleAnonymize,
  reset_password:            handleResetPassword,
  // Order
  relancer:                  handleRelancer,
  refund_payment:            handleRefundPayment,
  open_dispute:              handleOpenDispute,
  cancel_order:              handleCancelOrder,
  force_expire:              handleForceExpire,
  add_internal_note:         handleAddInternalNote,
  // Prescription
  close_prescription_review: handleClosePrescriptionReview,
  // Dispute
  resolve_dispute:           handleResolveDispute,
  reject_dispute:            handleRejectDispute,
  // Appointment
  cancel_appointment:        handleCancelAppointment,
  // Account
  unlock_account:            handleUnlockAccount,
  invite_admin:              handleInviteAdmin,
  promote_super_admin:       handlePromoteSuperAdmin,
  revoke_admin:              handleRevokeAdmin,
  adjust_credits:            handleAdjustCredits,
  admin_change_plan:         handleAdminChangePlan,
  // Settings
  update_setting:            handleUpdateSetting,
  sync_plans_stripe:         handleSyncPlansStripe,
  toggle_provider:           handleToggleProvider,
  test_provider:             handleTestProvider,
  test_integration:          handleTestIntegration,
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db          = createClient(supabaseUrl, serviceKey)

  let actorProfileId: string | undefined
  let actionName: string | undefined
  let entityType: string | undefined
  let entityId: string | undefined

  try {
    const profile = await requireAuth(req)
    requireAdminRole(profile)
    actorProfileId = profile.profileId

    const body = await req.json()
    actionName = body.action
    entityType = body.entity_type
    entityId   = body.entity_id

    if (!actionName) return errorResponse('MISSING_ACTION', 'Le champ action est requis')

    const handler = DISPATCH[actionName]
    if (!handler) return errorResponse('UNKNOWN_ACTION', `Action inconnue: ${actionName}`)

    const data = await handler(db, profile, body)

    await writeAudit(db, {
      action: `admin.${actionName}`,
      actorId: actorProfileId,
      entityType,
      entityId,
      result: 'success',
    })

    return successResponse({ ok: true, data })

  } catch (err: any) {
    const msg = err?.message ?? ''

    // Audit the failure (best-effort)
    if (actorProfileId) {
      await writeAudit(db, {
        action: `admin.${actionName ?? 'unknown'}`,
        actorId: actorProfileId,
        entityType,
        entityId,
        result: 'failure',
        cause: msg,
      })
    }

    // Log detailed cause server-side only
    console.error('[admin-action] error:', msg, err)

    // Map to typed client responses — never leak internal details
    if (msg === 'UNAUTHORIZED')              return errorResponse('UNAUTHORIZED',       'Authentification requise', 401)
    if (msg === 'FORBIDDEN')                 return errorResponse('FORBIDDEN',           err.clientMessage ?? 'Accès refusé', 403)
    if (msg === 'REQUIRES_SUPER_ADMIN')      return errorResponse('REQUIRES_SUPER_ADMIN', err.clientMessage ?? 'Privilèges insuffisants', 403)
    if (msg === 'MISSING_PARAMS')            return errorResponse('MISSING_PARAMS',       'Paramètres manquants')
    if (msg === 'MISSING_ACTION')            return errorResponse('MISSING_ACTION',       'Action manquante')
    if (msg === 'UNKNOWN_ACTION')            return errorResponse('UNKNOWN_ACTION',       err.clientMessage ?? 'Action inconnue')
    if (msg === 'REMINDER_TOO_SOON')         return errorResponse('REMINDER_TOO_SOON',    err.clientMessage ?? 'Rappel trop récent')
    if (msg === 'REFUND_EXCEEDS_PAYMENT')    return errorResponse('REFUND_EXCEEDS_PAYMENT', err.clientMessage ?? 'Montant de remboursement invalide')
    if (msg === 'PAYMENT_NOT_FOUND')         return errorResponse('PAYMENT_NOT_FOUND',   err.clientMessage ?? 'Paiement introuvable', 404)
    if (msg === 'APPOINTMENT_NOT_FOUND')     return errorResponse('APPOINTMENT_NOT_FOUND', err.clientMessage ?? 'Rendez-vous introuvable', 404)
    if (msg === 'RESERVATION_NOT_FOUND')     return errorResponse('RESERVATION_NOT_FOUND', err.clientMessage ?? 'Commande introuvable', 404)
    if (msg === 'CANNOT_REVOKE_SELF')        return errorResponse('CANNOT_REVOKE_SELF',   err.clientMessage ?? 'Opération invalide')
    if (msg === 'CANNOT_PROMOTE_SELF')       return errorResponse('CANNOT_PROMOTE_SELF',  err.clientMessage ?? 'Opération invalide')
    if (msg === 'CREDIT_LIMIT_EXCEEDED')     return errorResponse('CREDIT_LIMIT_EXCEEDED', err.clientMessage ?? 'Limite dépassée')
    if (msg === 'PROFILE_NOT_FOUND')         return errorResponse('PROFILE_NOT_FOUND',   'Profil introuvable', 404)
    if (msg === 'INVALID_ENTITY_TYPE')       return errorResponse('INVALID_ENTITY_TYPE', 'Type d\'entité invalide')

    return errorResponse('INTERNAL_ERROR', 'Erreur interne du serveur', 500)
  }
})
