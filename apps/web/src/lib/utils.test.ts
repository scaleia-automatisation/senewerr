import { describe, it, expect } from 'vitest'
import { formatFCFA, formatFCFACompact, formatRelativeDateTime, slugify } from './utils'

const NBSP = ' '

describe('formatFCFA', () => {
  it('formate avec espace insécable et suffixe FCFA', () => {
    expect(formatFCFA(4000)).toBe(`4${NBSP}000${NBSP}FCFA`)
  })
  it('gère les petits montants', () => {
    expect(formatFCFA(500)).toBe(`500${NBSP}FCFA`)
  })
  it('n\'utilise jamais « XOF »', () => {
    expect(formatFCFA(1000000)).not.toContain('XOF')
  })
})

describe('formatFCFACompact', () => {
  it('abrège les millions', () => {
    expect(formatFCFACompact(1200000)).toBe(`1,2${NBSP}M${NBSP}FCFA`)
  })
  it('abrège les milliers', () => {
    expect(formatFCFACompact(850000)).toBe(`850${NBSP}k${NBSP}FCFA`)
  })
  it('laisse les petits montants intacts', () => {
    expect(formatFCFACompact(999)).toBe(`999${NBSP}FCFA`)
  })
})

describe('formatRelativeDateTime', () => {
  it('affiche « aujourd\'hui » pour la date du jour', () => {
    const d = new Date()
    d.setHours(15, 0, 0, 0)
    expect(formatRelativeDateTime(d)).toMatch(/^aujourd'hui/)
  })
  it('affiche « demain » pour J+1', () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 30, 0, 0)
    expect(formatRelativeDateTime(d)).toMatch(/^demain/)
  })
  it('affiche « hier » pour J-1', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(formatRelativeDateTime(d)).toMatch(/^hier/)
  })
  it('affiche la date complète au-delà', () => {
    const d = new Date()
    d.setDate(d.getDate() + 10)
    expect(formatRelativeDateTime(d)).not.toMatch(/aujourd'hui|demain|hier/)
  })
})

describe('slugify', () => {
  it('normalise les accents et les espaces', () => {
    expect(slugify('Clinique Kër Santé')).toBe('clinique-ker-sante')
  })
})
