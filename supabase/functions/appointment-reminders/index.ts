import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Planification : toutes les heures (0 * * * *) ──────────
// Fenêtres de détection (gère la dérive horaire du cron) :
//   rappel la veille : starts_at ∈ [now+20h, now+28h]
//   rappel 2h avant  : starts_at ∈ [now+1h45m, now+2h15m]

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
  const results = { day_before: 0, two_hours: 0, errors: [] as string[] }

  // ── 1. Rappels "la veille" (fenêtre 20h–28h) ─────────────
  const from24 = new Date(now.getTime() + 20 * 60 * 60 * 1000).toISOString()
  const to24   = new Date(now.getTime() + 28 * 60 * 60 * 1000).toISOString()

  const { data: appts24, error: err24 } = await supabase
    .from('appointments')
    .select(`
      id, starts_at, reason,
      patient:patients!inner(profile:profiles!inner(user_id, first_name)),
      professional:professionals!inner(profile:profiles!inner(user_id, first_name)),
      establishment:establishments!inner(organization_id)
    `)
    .eq('status', 'confirmed')
    .is('reminder_24h_sent_at', null)
    .gte('starts_at', from24)
    .lte('starts_at', to24)

  if (err24) {
    results.errors.push(`24h query: ${err24.message}`)
  } else if (appts24) {
    for (const appt of appts24) {
      const hour = new Date(appt.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })
      const targets: { user_id: string; notification_type: string; title: string; body: string }[] = []

      // Patient
      const patientUserId = (appt.patient as any)?.profile?.user_id
      if (patientUserId) {
        targets.push({
          user_id: patientUserId,
          notification_type: 'appointment_reminder_day',
          title: 'Rappel rendez-vous demain',
          body: `Vous avez un rendez-vous demain à ${hour}. Pensez à ne pas être en retard.`,
        })
      }

      // Professionnel
      const proUserId = (appt.professional as any)?.profile?.user_id
      if (proUserId) {
        targets.push({
          user_id: proUserId,
          notification_type: 'appointment_reminder_day',
          title: 'Agenda de demain',
          body: `Rappel : vous avez un rendez-vous demain à ${hour}.`,
        })
      }

      // Personnel établissement (admins + staff actifs)
      const orgId = (appt.establishment as any)?.organization_id
      if (orgId) {
        const { data: members } = await supabase
          .from('organization_members')
          .select('profile:profiles!inner(user_id, role)')
          .eq('organization_id', orgId)
          .eq('status', 'active')

        for (const m of members ?? []) {
          const p = (m.profile as any)
          if (p?.user_id && ['establishment_admin', 'establishment_staff'].includes(p.role)) {
            targets.push({
              user_id: p.user_id,
              notification_type: 'appointment_reminder_day',
              title: 'Agenda de demain',
              body: `Rappel : un rendez-vous est prévu demain à ${hour}.`,
            })
          }
        }
      }

      // Envoyer les notifications
      let sent = false
      for (const t of targets) {
        const { error } = await supabase.functions.invoke('send-push-notification', { body: t })
        if (!error) sent = true
      }

      // Marquer comme envoyé
      if (sent || targets.length === 0) {
        await supabase
          .from('appointments')
          .update({ reminder_24h_sent_at: now.toISOString() })
          .eq('id', appt.id)
        results.day_before++
      }
    }
  }

  // ── 2. Rappels "2h avant" (fenêtre 1h45–2h15) ────────────
  const from2h = new Date(now.getTime() + 105 * 60 * 1000).toISOString() // +1h45
  const to2h   = new Date(now.getTime() + 135 * 60 * 1000).toISOString() // +2h15

  const { data: appts2h, error: err2h } = await supabase
    .from('appointments')
    .select(`
      id, starts_at, reason,
      patient:patients!inner(profile:profiles!inner(user_id))
    `)
    .eq('status', 'confirmed')
    .is('reminder_1h_sent_at', null)
    .gte('starts_at', from2h)
    .lte('starts_at', to2h)

  if (err2h) {
    results.errors.push(`2h query: ${err2h.message}`)
  } else if (appts2h) {
    for (const appt of appts2h) {
      const hour = new Date(appt.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })
      const patientUserId = (appt.patient as any)?.profile?.user_id

      if (patientUserId) {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: patientUserId,
            notification_type: 'appointment_reminder_2h',
            title: 'Rendez-vous dans 2 heures',
            body: `Votre rendez-vous est à ${hour}. Pensez à partir à l'avance.`,
          },
        })
      }

      await supabase
        .from('appointments')
        .update({ reminder_1h_sent_at: now.toISOString() })
        .eq('id', appt.id)

      results.two_hours++
    }
  }

  console.log('[appointment-reminders]', results)

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
