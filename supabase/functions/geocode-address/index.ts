import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'
import { z } from 'https://esm.sh/zod@3'

const schema = z.object({
  address: z.string().min(3).max(500),
  city:    z.string().max(100).optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  let body: unknown
  try { body = await req.json() }
  catch { return errorResponse('VALIDATION_ERROR', 'Corps JSON invalide') }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return errorResponse('VALIDATION_ERROR', parsed.error.message)

  const { address, city } = parsed.data
  const query = [address, city, 'Sénégal'].filter(Boolean).join(', ')
  const nominatimBase = Deno.env.get('NOMINATIM_BASE_URL') || 'https://nominatim.openstreetmap.org'

  try {
    const url = `${nominatimBase}/search?q=${encodeURIComponent(query)}&format=json&limit=3&countrycodes=sn`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Medikool/1.0 (contacts.scale.ia@gmail.com)',
        'Accept-Language': 'fr,en',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    const results = await res.json() as Array<{
      lat: string; lon: string; display_name: string
    }>

    if (!results.length) {
      return successResponse({ results: [], fallback: true })
    }

    return successResponse({
      results: results.map(r => ({
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        display_name: r.display_name,
      })),
    })
  } catch (err) {
    // Repli : retourne erreur indiquant saisie manuelle
    console.warn('[geocode-address] Nominatim unavailable:', err)
    return successResponse({ results: [], fallback: true, error: 'Géocodage indisponible' })
  }
})
