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

    const { prescriptionId, documentId, text } = await req.json()
    if (!prescriptionId && !documentId && !text) {
      return errorResponse('INVALID_INPUT', 'One of prescriptionId, documentId, or text is required', 400)
    }

    // Resolve patient record for ownership checks
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', profile.profileId)
      .single()

    if (!patient) return errorResponse('NOT_FOUND', 'Patient not found', 404)

    let context = ''

    if (prescriptionId) {
      const { data: prescription } = await supabase
        .from('prescriptions')
        .select('prescription_number, issued_at, prescription_items(medicine_name, dosage, form, frequency, duration_days)')
        .eq('id', prescriptionId)
        .eq('patient_id', patient.id)
        .single()

      if (!prescription) return errorResponse('NOT_FOUND', 'Prescription not found', 404)

      context = `Ordonnance N°${prescription.prescription_number}\nDate: ${prescription.issued_at}\nMédicaments:\n`
      for (const item of (prescription.prescription_items as any[]) ?? []) {
        context += `- ${item.medicine_name} ${item.dosage} ${item.form}: ${item.frequency} pendant ${item.duration_days} jours\n`
      }
    } else if (documentId) {
      const { data: doc } = await supabase
        .from('documents')
        .select('content_text, title')
        .eq('id', documentId)
        .eq('patient_id', patient.id)
        .single()

      if (!doc) return errorResponse('NOT_FOUND', 'Document not found', 404)
      context = doc.content_text ?? ''
    } else {
      context = String(text).slice(0, 5000)
    }

    // Charge 1 credit before calling AI
    let generationId: string
    try {
      generationId = await chargeCredits(supabase, profile.profileId, 'explain_document', 1, 'gpt-4.1-mini')
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
                'Tu es un assistant médical patient. Explique ce document médical en termes simples. Structure: 1) Ce que dit le document 2) Ce que ça signifie pour vous 3) Ce que vous devriez faire. Sois bienveillant et précis.',
            },
            { role: 'user', content: context },
          ],
        }),
      })

      aiData = await aiRes.json()

      if (!aiRes.ok) {
        await refundCredits(supabase, profile.profileId, generationId, 1, 'AI_PROVIDER_ERROR')
        return errorResponse('AI_PROVIDER_ERROR', aiData?.error?.message ?? 'Erreur du fournisseur IA', 502)
      }
    } catch (fetchErr) {
      await refundCredits(supabase, profile.profileId, generationId, 1, 'AI_PROVIDER_ERROR')
      return errorResponse('AI_PROVIDER_TIMEOUT', 'Le fournisseur IA ne répond pas', 504)
    }

    const explanation = aiData.choices?.[0]?.message?.content ?? ''
    const tokensIn = aiData.usage?.prompt_tokens ?? 0
    const tokensOut = aiData.usage?.completion_tokens ?? 0

    await completeGeneration(supabase, generationId, tokensIn, tokensOut)

    return successResponse({
      explanation,
      disclaimer: "Ceci est une aide à la compréhension, pas un avis médical.",
    })
  } catch (err) {
    console.error(err)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
})
