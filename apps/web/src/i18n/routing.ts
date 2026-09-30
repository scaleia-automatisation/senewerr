import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['fr', 'wo', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
})
