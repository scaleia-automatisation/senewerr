import { Link } from 'react-router-dom'

const FOOTER_LINKS = {
  Plateforme: [
    { href: '/#features', label: 'Fonctionnalités' },
    { href: '/#tarifs',   label: 'Tarifs' },
    { href: '/#comment',  label: 'Comment ça marche' },
    { href: '/blog',      label: 'Blog' },
  ],
  Solutions: [
    { href: '/solutions/patients',       label: 'Patients' },
    { href: '/solutions/professionnels', label: 'Professionnels' },
    { href: '/solutions/etablissements', label: 'Établissements' },
    { href: '/solutions/pharmacies',     label: 'Pharmacies' },
    { href: '/solutions/mutuelles',      label: 'Mutuelles' },
  ],
  Légal: [
    { href: '/legal/mentions',        label: 'Mentions légales' },
    { href: '/legal/confidentialite', label: 'Confidentialité' },
    { href: '/legal/cgu',             label: 'CGU' },
    { href: '/legal/donnees-sante',   label: 'Données de santé' },
  ],
  Support: [
    { href: '/contact',                   label: 'Contact' },
    { href: '/faq',                       label: 'FAQ' },
    { href: 'mailto:support@senewerr.com', label: 'support@senewerr.com' },
  ],
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface-2">
      <div className="mx-auto max-w-container px-s-4 py-s-7 sm:px-s-6">
        <div className="grid grid-cols-2 gap-s-6 sm:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <div className="flex items-center gap-s-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <span className="font-display text-small font-bold text-primary-fg">SW</span>
              </div>
              <span className="font-display text-h3 font-semibold text-ink">Séne Wérr</span>
            </div>
            <p className="mt-s-1 text-micro font-medium text-primary">Votre santé connectée et centralisée</p>
            <p className="mt-s-3 text-small leading-relaxed text-ink-2">
              Plateforme de santé numérique au Sénégal — patients, professionnels, établissements, pharmacies et mutuelles réunis.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h3 className="mb-s-3 text-micro font-semibold uppercase tracking-[0.06em] text-ink-3">{group}</h3>
              <ul className="flex flex-col gap-s-2">
                {links.map(link => (
                  <li key={link.href}>
                    <Link to={link.href} className="text-small text-ink-2 transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-s-6 flex flex-col items-center justify-between gap-s-3 border-t border-line pt-s-5 sm:flex-row">
          <p className="text-micro text-ink-3">© {new Date().getFullYear()} Séne Wérr. Tous droits réservés.</p>
          <p className="text-micro text-ink-3">Conçu au Sénégal</p>
        </div>
      </div>
    </footer>
  )
}
