import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from '@/i18n/fr.json'
import wo from '@/i18n/wo.json'
import en from '@/i18n/en.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      wo: { translation: wo },
      en: { translation: en },
    },
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    ns: ['translation'],
    defaultNS: 'translation',
  })

export default i18n
