import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Planification : toutes les 5 minutes (*/5 * * * *) ─────
// Fenêtre de détection :
//   pickup_scheduled_at ∈ [now+25min, now+35min]
//   → notifie la pharmacie de commencer la préparation

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date()
  const from = new Date(now.getTime() + 25 * 60 * 1000).toISOString() // +25 min
  const to   = new Date(now.getTime() + 35 * 60 * 1000).toISOString() // +35 min

  const results = { sent: 0, errors: [] as string[] }

  const { data: reservations, error } = await supabase
    .from('pharmacy_reservations')
    .select(`
      id, pickup_scheduled_at, reservation_number,
      pharmacy:pharmacies!inner(organization_id)
    `)
    .is('reminder_30m_sent_at', null)
    .gte('pickup_scheduled_at', from)
    .lte('pickup_scheduled_at', to)
    .not('status', 'in', '("completed","cancelled","expired","refunded")')

  if (error) {
    results.errors.push(error.message)
    return new Response(JSON.stringify(results), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  for (const reservation of reservations ?? []) {
    const orgId = (reservation.pharmacy as any)?.organization_id
    const hour = new Date(reservation.pickup_scheduled_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar',
    })

    // Récupère les membres actifs de la pharmacie (admin + staff)
    const { data: members } = await supabase
      .from('organization_members')
      .select('profile:profiles!inner(user_id, role)')
      .eq('organization_id', orgId)
      .eq('status', 'active')

    let notified = false
    for (const m of members ?? []) {
      const p = (m.profile as any)
      if (!p?.user_id || !['pharmacy_admin', 'pharmacy_staff'].includes(p.role)) continue

      const { error: notifErr } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: p.user_id,
          notification_type: 'reservation_reminder',
          title: `Réservation à préparer — ${reservation.reservation_number}`,
          body: `Retrait prévu à ${hour}. Commencez la préparation maintenant.`,
          url: '/pharmacie/reservations',
        },
      })
      if (!notifErr) notified = true
    }

    // Marquer comme envoyé pour ne pas renvoyer lors du prochain passage
    if (notified || (members ?? []).length === 0) {
      await supabase
        .from('pharmacy_reservations')
        .update({ reminder_30m_sent_at: now.toISOString() })
        .eq('id', reservation.id)
      results.sent++
    }
  }

  console.log('[reservation-reminders]', results)

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
