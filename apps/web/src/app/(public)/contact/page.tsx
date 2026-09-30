import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import { Mail, Phone, MapPin } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-10 space-y-8 w-full">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-[var(--sw-ink)]">Contactez-nous</h1>
          <p className="text-[var(--sw-ink-2)]">Notre équipe est disponible pour répondre à vos questions</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Mail, label: 'Email', value: 'contact@senewerr.sn', href: 'mailto:contact@senewerr.sn' },
            { icon: Phone, label: 'Téléphone', value: '+221 33 000 00 00', href: 'tel:+221330000000' },
            { icon: MapPin, label: 'Adresse', value: 'Dakar, Sénégal', href: null },
          ].map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="sw-card p-5 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center mx-auto">
                <Icon className="w-5 h-5 text-[var(--sw-primary)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--sw-ink-3)] uppercase tracking-wide font-medium">{label}</p>
                {href ? (
                  <a href={href} className="text-sm font-medium text-[var(--sw-primary)] hover:underline">{value}</a>
                ) : (
                  <p className="text-sm font-medium text-[var(--sw-ink)]">{value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="sw-card p-6 text-center space-y-2">
          <p className="text-sm font-medium text-[var(--sw-ink)]">Support disponible</p>
          <p className="text-sm text-[var(--sw-ink-2)]">Lundi – Vendredi : 8h – 18h | Samedi : 9h – 13h</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Réponse sous 24h ouvrées</p>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
