// Spec 24 — Multilingue : français, wolof, anglais américain
import { translations, type TranslationDict } from './translations'

export const LOCALES = ['fr', 'wo', 'en'] as const
export type Locale = typeof LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'fr'

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  wo: 'Wolof',
  en: 'English',
}

// Résolution d'une clé pointée par des points : 'nav.dashboard' → valeur dans le dict
type NestedValue<T, K extends string> =
  K extends `${infer Head}.${infer Tail}`
    ? Head extends keyof T ? NestedValue<T[Head], Tail> : never
    : K extends keyof T ? T[K] : never

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = translations[locale] ?? translations[DEFAULT_LOCALE]
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = dict
  for (const p of parts) {
    if (node == null || typeof node !== 'object') { node = undefined; break }
    node = node[p]
  }
  let result: string = typeof node === 'string' ? node : key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replaceAll(`{{${k}}}`, String(v))
    }
  }
  return result
}

export { translations }
export type { TranslationDict }
