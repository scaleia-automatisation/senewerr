import { corsHeaders } from './cors.ts'

export function errorResponse(code: string, msg: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code, message: msg } }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

export function successResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ data }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
