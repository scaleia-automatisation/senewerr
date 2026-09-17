import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// TODO: Implémenté au Bloc correspondant
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  // SCAFFOLD — à compléter
  return successResponse({ message: 'search-medicines not yet implemented' }, 501)
})
