import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'
import { chargeCredits, completeGeneration, refundCredits } from '../_shared/credits.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const profile = await requireAuth(req)

    const { appointmentId } = await req.json()
    if (!appointmentId) return errorResponse('INVALID_INPUT', 'appointmentId is required', 400)

    const { data: appt } = await supabase
      .from('appointments')
      .select(`
        id, reason, starts_at,
        patient:patients(
          id,
          profile:profiles(first_name, last_name, date_of_birth, gender)
        ),
        professional:professionals(profile_id, specialty)
      `)
      .eq('id', appointmentId)
      .single()

    if (!appt) return errorResponse('NOT_FOUND', 'Appointment not found', 404)

    const pro = appt.professional as any
    if (pro?.profile_id !== profile.profileId) return errorResponse('FORBIDDEN', 'Access denied', 403)

    const patient = appt.patient as any
    const pp = patient?.profile
    const dob = pp?.date_of_birth ? new Date(pp.date_of_birth) : null
    const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null
    const patientName = `${pp?.first_name ?? ''} ${pp?.last_name ?? ''}`.trim()

    const [pastAppts, prescriptions] = await Promise.all([
      supabase
        .from('appointments')
        .select('reason, starts_at')
        .eq('patient_id', patient?.id)
        .eq('status', 'completed')
        .order('starts_at', { ascending: false })
        .limit(5),
      supabase
        .from('prescriptions')
        .select('issued_at, prescription_items(medicine_name, dosage, frequency)')
        .eq('patient_id', patient?.id)
        .order('issued_at', { ascending: false })
        .limit(3),
    ])

    let context = `Patient: ${patientName}, ${age ?? '?'}ans, ${pp?.gender ?? 'inconnu'}.\n`
    context += `Motif actuel: ${(appt as any).reason ?? 'Non précisé'}.\n\n`

    const past = pastAppts.data ?? []
    if (past.length) {
      context += `Dernières consultations:\n`
      for (const a of past) {
        context += `- ${new Date(a.starts_at).toLocaleDateString('fr-FR')}: ${a.reason ?? 'Sans motif'}\n`
      }
    }

    const activeMedications: string[] = []
    const rxs = prescriptions.data ?? []
    if (rxs.length) {
      context += `\nOrdonnances récentes:\n`
      for (const p of rxs) {
        const meds = ((p.prescription_items as any[]) ?? []).map((i) => `${i.medicine_name} ${i.dosage}`)
        activeMedications.push(...meds)
        context += `- ${new Date(p.issued_at).toLocaleDateString('fr-FR')}: ${meds.join(', ')}\n`
      }
    }

    // Charge 2 credits before calling AI
    let generationId: string
    try {
      generationId = await chargeCredits(supabase, profile.profileId, 'pre_consultation_summary', 2, 'gpt-4.1-mini')
    } catch (err: any) {
      if (err?.code === 'INSUFFICIENT_CREDITS') {
        return errorResponse('INSUFFICIENT_CREDITS', err.message, 402)
      }
      throw err
    }

    let aiData: any
    try {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content:
                "Tu es un assistant médical. Prépare un résumé pré-consultation concis pour le professionnel de santé. Inclus: 1) Contexte patient 2) Motif actuel 3) Historique pertinent 4) Points d'attention 5) Questions suggérées.",
            },
            { role: 'user', content: context },
          ],
        }),
      })

      aiData = await aiRes.json()

      if (!aiRes.ok) {
        await refundCredits(supabase, profile.profileId, generationId, 2, 'AI_PROVIDER_ERROR')
        return errorResponse('AI_PROVIDER_ERROR', aiData?.error?.message ?? 'Erreur du fournisseur IA', 502)
      }
    } catch (fetchErr) {
      await refundCredits(supabase, profile.profileId, generationId, 2, 'AI_PROVIDER_ERROR')
      return errorResponse('AI_PROVIDER_TIMEOUT', 'Le fournisseur IA ne répond pas', 504)
    }

    const summary = aiData.choices?.[0]?.message?.content ?? ''
    const tokensIn = aiData.usage?.prompt_tokens ?? 0
    const tokensOut = aiData.usage?.completion_tokens ?? 0

    await completeGeneration(supabase, generationId, tokensIn, tokensOut)

    return successResponse({ summary, patientAge: age, activeMedications })
  } catch (err) {
    console.error(err)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
})
