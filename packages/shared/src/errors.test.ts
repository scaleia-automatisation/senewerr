import { describe, it, expect } from 'vitest'
import {
  makeError,
  errorResponse,
  successResponse,
  formatErrorMessage,
  isSecFamily,
} from './errors'

describe('errors.ts', () => {
  it('makeError SEC_* — cause masquée', () => {
    const err = makeError('SEC_TENANT_VIOLATION', 'profile_id mismatch: 123 ≠ 456')
    expect(err.cause).toBeUndefined()
    expect(err.http).toBe(403)
    expect(err.retryable).toBe(false)
  })

  it('makeError VAL_INVALID_INPUT — cause visible', () => {
    const err = makeError('VAL_INVALID_INPUT', 'doit être un email valide', 'email')
    expect(err.cause).toBe('doit être un email valide')
    expect(err.entity).toBe('email')
    expect(err.http).toBe(400)
  })

  it('makeError SYS_DB_ERROR — retryable', () => {
    const err = makeError('SYS_DB_ERROR', 'connection timeout', undefined, { requestId: 'abc123' })
    expect(err.retryable).toBe(true)
    expect(err.http).toBe(500)
  })

  it('makeError PAYMENT_DECLINED — 402', () => {
    const err = makeError('PAYMENT_DECLINED', undefined, undefined, { declineReason: 'fonds insuffisants' })
    expect(err.http).toBe(402)
  })

  it('makeError AI_PROVIDER_TIMEOUT — retryable', () => {
    const err = makeError('AI_PROVIDER_TIMEOUT')
    expect(err.retryable).toBe(true)
    expect(err.http).toBe(502)
  })

  it('makeError PLAN_LIMIT_REACHED — 402', () => {
    const err = makeError('PLAN_LIMIT_REACHED', undefined, 'consultations_IA', { current: 50, max: 50 })
    expect(err.http).toBe(402)
    expect(err.entity).toBe('consultations_IA')
  })

  it('formatErrorMessage interpole {meta.*}', () => {
    const err = makeError('SEC_RATE_LIMITED', undefined, undefined, { retryAfter: 30 })
    // SEC_* : cause masquée mais meta accessible pour le message
    const msg = formatErrorMessage({
      ...err,
      message: 'Trop de requêtes. Réessayez dans {meta.retryAfter} s.',
    })
    expect(msg).toContain('30')
  })

  it('formatErrorMessage interpole {entity} et {cause}', () => {
    const err = makeError('VAL_MISSING_FIELD', undefined, 'prenom')
    const msg = formatErrorMessage(err)
    expect(msg).toContain('prenom')
  })

  it('isSecFamily', () => {
    expect(isSecFamily('SEC_TENANT_VIOLATION')).toBe(true)
    expect(isSecFamily('SEC_CAPTCHA_FAILED')).toBe(true)
    expect(isSecFamily('VAL_INVALID_INPUT')).toBe(false)
    expect(isSecFamily('SYS_DB_ERROR')).toBe(false)
  })

  it('errorResponse shape', () => {
    const res = errorResponse('PERM_DENIED', 'wrong tenant', undefined, undefined, 'req-001')
    expect(res.ok).toBe(false)
    expect(res.error.code).toBe('PERM_DENIED')
    expect(res.request_id).toBe('req-001')
  })

  it('successResponse shape', () => {
    const res = successResponse({ id: 1 }, 'req-002')
    expect(res.ok).toBe(true)
    expect(res.data).toEqual({ id: 1 })
  })

  it('SEC_* cause jamais exposée même si fournie', () => {
    const codes: Array<Parameters<typeof makeError>[0]> = [
      'SEC_TENANT_VIOLATION',
      'SEC_RATE_LIMITED',
      'SEC_WEBHOOK_SIGNATURE',
      'SEC_WITHDRAWAL_LOCKED',
      'SEC_CAPTCHA_FAILED',
    ]
    for (const code of codes) {
      const err = makeError(code, 'sensitive-internal-info')
      expect(err.cause, `${code} should have no cause`).toBeUndefined()
    }
  })

  it('makeError CEILING_EXCEEDED — meta accessible', () => {
    const err = makeError('CEILING_EXCEEDED', undefined, undefined, { remaining: 5000 })
    expect(err.http).toBe(409)
    expect(err.meta?.remaining).toBe(5000)
  })
})
