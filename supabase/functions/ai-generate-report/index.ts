import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'
import { chargeCredits, completeGeneration, refundCredits } from '../_shared/credits.ts'

type ReportType = 'compte_rendu_consultation' | 'lettre_medecin' | 'certificat_medical'

const SYSTEM_PROMPTS: Record<ReportType, string> = {
  compte_rendu_consultation:
    "Tu es un médecin rédigeant un compte rendu de consultation. Génère un document clinique formel structuré avec: en-tête complet (médecin, patient, date, établissement), motif de consultation, examen clinique, diagnostic, traitement et prescriptions, conclusion, et un espace pour date/signature. Style médical professionnel en français.",
  lettre_medecin:
    "Tu es un médecin rédigeant une lettre de correspondance confraternelle. Rédige une lettre formelle au spécialiste destinataire avec: formule d'appel, contexte patient complet, motif d'adressage, antécédents pertinents, traitement en cours, bilan récent, et formule de clôture professionnelle. Style confraternelle et précis.",
  certificat_medical:
    "Tu es un médecin rédigeant un certificat médical officiel. Génère un certificat formel attestant de l'état de santé du patient pour la finalité indiquée. Inclus: identification complète du médecin, identification du patient, attestation médicale précise, objet du certificat, date et lieu d'établissement. Style officiel, concis et sans ambiguïté.",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const profile = await requireAuth(req)

    const { consultationId, reportType, recipientName, purpose } = await req.json()
    if (!consultationId || !reportType) {
      return errorResponse('INVALID_INPUT', 'consultationId and reportType are required', 400)
    }
    if (!SYSTEM_PROMPTS[reportType as ReportType]) {
      return errorResponse('INVALID_INPUT', 'Invalid reportType', 400)
    }

    const { data: consultation } = await supabase
      .from('consultations')
      .select(`
        id, notes, diagnosis, created_at,
        appointment:appointments(
          reason, starts_at,
          patient:patients(
            id,
            profile:profiles(first_name, last_name, date_of_birth, gender)
          ),
          professional:professionals(
            profile_id, specialty,
            profile:profiles(first_name, last_name),
            organization:organizations(name, city)
          )
        )
      `)
      .eq('id', consultationId)
      .single()

    if (!consultation) return errorResponse('NOT_FOUND', 'Consultation not found', 404)

    const appt = consultation.appointment as any
    const pro = appt?.professional
    if (pro?.profile_id !== profile.profileId) return errorResponse('FORBIDDEN', 'Access denied', 403)

    const pp = appt?.patient?.profile
    const proProfile = pro?.profile
    const org = pro?.organization
    const dob = pp?.date_of_birth ? new Date(pp.date_of_birth) : null
    const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null
    const consultDate = new Date(consultation.created_at).toLocaleDateString('fr-FR')
    const patientName = `${pp?.first_name ?? ''} ${pp?.last_name ?? ''}`.trim()
    const proName = `Dr. ${proProfile?.first_name ?? ''} ${proProfile?.last_name ?? ''}`.trim()

    const contextLines = [
      `Médecin: ${proName}, ${pro?.specialty ?? ''}`,
      `Établissement: ${org?.name ?? ''}, ${org?.city ?? ''}`,
      `Patient: ${patientName}, ${age ?? '?'} ans, ${pp?.gender ?? ''}`,
      `Date de naissance: ${pp?.date_of_birth ?? 'inconnue'}`,
      `Date de consultation: ${consultDate}`,
      `Motif: ${appt?.reason ?? 'Non précisé'}`,
      `Notes cliniques: ${consultation.notes ?? 'Aucune'}`,
      `Diagnostic: ${consultation.diagnosis ?? 'Non précisé'}`,
      recipientName ? `Destinataire: ${recipientName}` : null,
      purpose ? `Objet / Finalité: ${purpose}` : null,
    ].filter(Boolean).join('\n')

    // Charge 3 credits before calling AI
    let generationId: string
    try {
      generationId = await chargeCredits(supabase, profile.profileId, 'generate_report', 3, 'gpt-4.1-mini')
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
            { role: 'system', content: SYSTEM_PROMPTS[reportType as ReportType] },
            { role: 'user', content: contextLines },
          ],
        }),
      })

      aiData = await aiRes.json()

      if (!aiRes.ok) {
        await refundCredits(supabase, profile.profileId, generationId, 3, 'AI_PROVIDER_ERROR')
        return errorResponse('AI_PROVIDER_ERROR', aiData?.error?.message ?? 'Erreur du fournisseur IA', 502)
      }
    } catch (fetchErr) {
      await refundCredits(supabase, profile.profileId, generationId, 3, 'AI_PROVIDER_ERROR')
      return errorResponse('AI_PROVIDER_TIMEOUT', 'Le fournisseur IA ne répond pas', 504)
    }

    const generatedText = aiData.choices?.[0]?.message?.content ?? ''
    const tokensIn = aiData.usage?.prompt_tokens ?? 0
    const tokensOut = aiData.usage?.completion_tokens ?? 0

    const { data: doc } = await supabase
      .from('documents')
      .insert({
        patient_id: appt?.patient?.id,
        document_type: reportType,
        title: `Compte rendu du ${consultDate}`,
        content_text: generatedText,
        created_by: profile.profileId,
      })
      .select('id')
      .single()

    await completeGeneration(supabase, generationId, tokensIn, tokensOut)

    return successResponse({ documentId: doc?.id, content: generatedText })
  } catch (err) {
    console.error(err)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
})
