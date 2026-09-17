import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

/** Add hours to a Date and return ISO string */
function addHours(date: Date, hours: number): string {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString()
}

/** Add minutes to a Date and return ISO string */
function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // No auth — verify cron secret header
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = db()
  const now = new Date()

  // ─── 2. Expire overdue reservations ──────────────────────────────────────────

  const NON_TERMINAL_STATUSES = ['confirmed', 'refused', 'expired', 'withdrawn']

  const { data: expiredReservations } = await supabase
    .from('pharmacy_reservations')
    .select(`
      id, reservation_number, patient_id, pharmacy_id,
      reservation_items(id, product_id, quantity)
    `)
    .lt('expires_at', now.toISOString())
    .not('pharmacy_status', 'in', `(${NON_TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`)

  let expiredCount = 0

  for (const reservation of expiredReservations ?? []) {
    // 3. Update status to expired
    const { error: updateErr } = await supabase
      .from('pharmacy_reservations')
      .update({ pharmacy_status: 'expired' })
      .eq('id', reservation.id)

    if (updateErr) {
      console.error(`Failed to expire reservation ${reservation.id}: ${updateErr.message}`)
      continue
    }

    expiredCount++

    // 3b. Release reserved stock per item
    for (const item of (reservation.reservation_items as any[]) ?? []) {
      const { data: product } = await supabase
        .from('pharmacy_products')
        .select('reserved_quantity')
        .eq('id', item.product_id)
        .single()

      if (product) {
        await supabase
          .from('pharmacy_products')
          .update({ reserved_quantity: Math.max(0, product.reserved_quantity - item.quantity) })
          .eq('id', item.product_id)
      }

      await supabase.from('pharmacy_stock_movements').insert({
        product_id: item.product_id,
        delta: item.quantity,
        movement_type: 'release',
        reservation_id: reservation.id,
        reason: 'Réservation expirée',
      })
    }

    // 3c. Notify patient
    if (reservation.patient_id) {
      await supabase.from('notifications').insert({
        recipient_id: reservation.patient_id,
        type: 'RESERVATION_EXPIRED',
        title: 'Réservation expirée',
        body: `Votre réservation ${reservation.reservation_number} a expiré (délai de 24h dépassé)`,
        reference_id: reservation.id,
      })
    }
  }

  // ─── 4. 24h appointment reminders ────────────────────────────────────────────

  const window24hStart = addHours(now, 23)
  const window24hEnd = addHours(now, 25)

  const { data: appointments24h } = await supabase
    .from('appointments')
    .select('id, patient_id, professional_id, starts_at, appointment_number')
    .gt('starts_at', window24hStart)
    .lt('starts_at', window24hEnd)
    .in('status', ['confirmed', 'paid'])
    .is('reminder_24h_sent_at', null)

  let reminders24hCount = 0

  for (const appt of appointments24h ?? []) {
    const { error: updateErr } = await supabase
      .from('appointments')
      .update({ reminder_24h_sent_at: now.toISOString() })
      .eq('id', appt.id)
      .is('reminder_24h_sent_at', null) // idempotent guard

    if (updateErr) {
      console.error(`Failed to set 24h reminder for appointment ${appt.id}: ${updateErr.message}`)
      continue
    }

    reminders24hCount++

    if (appt.patient_id) {
      const startsAt = new Date(appt.starts_at)
      const timeStr = startsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const dateStr = startsAt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

      await supabase.from('notifications').insert({
        recipient_id: appt.patient_id,
        type: 'APPOINTMENT_REMINDER_24H',
        title: 'Rappel rendez-vous — demain',
        body: `Rappel : votre rendez-vous est prévu ${dateStr} à ${timeStr}`,
        reference_id: appt.id,
      })
    }
  }

  // ─── 5. 1h appointment reminders ─────────────────────────────────────────────

  const window1hStart = addMinutes(now, 50)
  const window1hEnd = addMinutes(now, 70)

  const { data: appointments1h } = await supabase
    .from('appointments')
    .select('id, patient_id, professional_id, starts_at, appointment_number')
    .gt('starts_at', window1hStart)
    .lt('starts_at', window1hEnd)
    .in('status', ['confirmed', 'paid'])
    .is('reminder_1h_sent_at', null)

  let reminders1hCount = 0

  for (const appt of appointments1h ?? []) {
    const { error: updateErr } = await supabase
      .from('appointments')
      .update({ reminder_1h_sent_at: now.toISOString() })
      .eq('id', appt.id)
      .is('reminder_1h_sent_at', null) // idempotent guard

    if (updateErr) {
      console.error(`Failed to set 1h reminder for appointment ${appt.id}: ${updateErr.message}`)
      continue
    }

    reminders1hCount++

    if (appt.patient_id) {
      const startsAt = new Date(appt.starts_at)
      const timeStr = startsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

      await supabase.from('notifications').insert({
        recipient_id: appt.patient_id,
        type: 'APPOINTMENT_REMINDER_1H',
        title: 'Rendez-vous dans 1 heure',
        body: `Votre rendez-vous est dans environ 1 heure (${timeStr}). N'oubliez pas !`,
        reference_id: appt.id,
      })
    }
  }

  // ─── 6. Return summary ────────────────────────────────────────────────────────

  return successResponse({
    expired_reservations: expiredCount,
    reminders_24h: reminders24hCount,
    reminders_1h: reminders1hCount,
  })
})
