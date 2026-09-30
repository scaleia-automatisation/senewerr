import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Séné Wérr — Votre santé connectée et centralisée',
    template: '%s — Séné Wérr',
  },
  description:
    'Retrouvez vos informations de santé, prenez rendez-vous, consultez vos ordonnances, recherchez des médicaments et gérez votre couverture santé depuis un seul espace.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://senewerr.sn'),
  openGraph: {
    siteName: 'Séné Wérr',
    locale: 'fr_SN',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
