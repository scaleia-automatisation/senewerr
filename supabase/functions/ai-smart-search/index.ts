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

    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return errorResponse('INVALID_INPUT', 'text is required', 400)
    }

    // Rate limit: 10 calls per minute per user
    const { count } = await supabase
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .eq('feature', 'smart_search')
      .gt('created_at', new Date(Date.now() - 60_000).toISOString())

    if ((count ?? 0) >= 10) {
      return errorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests, please wait a minute', 429)
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
              "Tu es un assistant de recherche médicale. L'utilisateur décrit ce qu'il cherche. Extrait des filtres en JSON avec les champs (omets si non pertinents): specialty (string), city (string), teleconsultation (boolean), max_fee (number), availability (today|this_week|any), keywords (string[]). Réponds UNIQUEMENT avec du JSON valide.",
          },
          { role: 'user', content: text },
        ],
      }),
    })

    const aiData = await aiRes.json()
    const raw = aiData.choices?.[0]?.message?.content ?? '{}'

    let filters: Record<string, unknown>
    try {
      filters = JSON.parse(raw)
    } catch {
      filters = {}
    }

    const tokensIn = aiData.usage?.prompt_tokens ?? 0
    const tokensOut = aiData.usage?.completion_tokens ?? 0

    await supabase.from('ai_usage').insert({
      profile_id: profile.id,
      feature: 'smart_search',
      credits_used: 0,
      model: 'gpt-4.1-mini',
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    })

    return successResponse({ filters })
  } catch (err) {
    console.error(err)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
})
