import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const profile = await requireAuth(req, supabase)

    const { prescriptionId, documentId, text } = await req.json()
    if (!prescriptionId && !documentId && !text) {
      return errorResponse('INVALID_INPUT', 'One of prescriptionId, documentId, or text is required', 400)
    }

    // Resolve patient record for ownership checks
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', profile.id)
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

    const aiData = await aiRes.json()
    const explanation = aiData.choices?.[0]?.message?.content ?? ''
    const tokensIn = aiData.usage?.prompt_tokens ?? 0
    const tokensOut = aiData.usage?.completion_tokens ?? 0

    await supabase.from('ai_usage').insert({
      profile_id: profile.id,
      feature: 'explain_document',
      credits_used: 1,
      model: 'gpt-4.1-mini',
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    })

    return successResponse({
      explanation,
      disclaimer: "Ceci est une aide à la compréhension, pas un avis médical.",
    })
  } catch (err) {
    console.error(err)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
})
