import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const NBSP = ' '

/**
 * Montant en francs CFA côté patient : « 4 000 FCFA »
 * Espace insécable comme séparateur de milliers, jamais « XOF ».
 */
export function formatFCFA(amount: number): string {
  const grouped = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\s/g, NBSP)
  return `${grouped}${NBSP}FCFA`
}

/** Montant compact pour KPI : « 1,2 M FCFA », « 850 k FCFA » */
export function formatFCFACompact(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) {
    const v = (amount / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')
    return `${v}${NBSP}M${NBSP}FCFA`
  }
  if (abs >= 1_000) {
    const v = Math.round(amount / 1_000)
    return `${v}${NBSP}k${NBSP}FCFA`
  }
  return formatFCFA(amount)
}

const DAY_MS = 86_400_000

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/**
 * Date relative française :
 *   « aujourd'hui 15:00 », « demain 09:30 », sinon « mar. 22 sept. 09:30 »
 */
export function formatRelativeDateTime(date: string | Date): string {
  const d = new Date(date)
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d)
  const diffDays = Math.round((startOfDay(d) - startOfDay(new Date())) / DAY_MS)

  if (diffDays === 0) return `aujourd'hui ${time}`
  if (diffDays === 1) return `demain ${time}`
  if (diffDays === -1) return `hier ${time}`

  const day = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d)
  return `${day} ${time}`
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
