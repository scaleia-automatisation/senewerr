// Utilitaire serveur — lit la locale depuis le cookie `sw-locale`
import { cookies } from 'next/headers'
import { LOCALES, DEFAULT_LOCALE, type Locale, t } from './index'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('sw-locale')?.value
  if (raw && (LOCALES as readonly string[]).includes(raw)) return raw as Locale
  return DEFAULT_LOCALE
}

// Raccourci : t() pré-bindé à la locale courante pour les composants serveur
export async function getT() {
  const locale = await getLocale()
  return (key: string, vars?: Record<string, string | number>) => t(locale, key, vars)
}
