import { LegalLayout } from './LegalLayout'
import { Card } from '@/components/ui/Card'

export const META = {
  title: 'Politique des cookies | Medikool',
  description:
    "Medikool utilise uniquement des cookies techniques nécessaires. Aucun cookie publicitaire ni tracker tiers.",
}

export default function Cookies() {
  return (
    <LegalLayout title="Politique des cookies" lastUpdated="17 septembre 2026">
      <div className="space-y-s-8 text-body text-ink-2 leading-relaxed">

        <section>
          <h2 data-toc id="principe" className="text-h2 font-semibold text-ink mb-s-3">
            1. Notre engagement : le minimum nécessaire
          </h2>
          <p>
            Medikool applique une politique stricte en matière de cookies et de traceurs :
            nous ne déposons sur votre terminal <strong>que les cookies techniquement
            indispensables</strong> au fonctionnement du service. Aucun cookie à des fins
            publicitaires, aucun tracker de réseau social, aucun outil de profilage commercial
            n'est utilisé sur notre plateforme.
          </p>
        </section>

        <section>
          <h2 data-toc id="cookies-techniques" className="text-h2 font-semibold text-ink mb-s-3">
            2. Cookies strictement nécessaires
          </h2>
          <p>
            Ces cookies sont indispensables à la navigation et à la sécurité de votre session.
            Ils ne nécessitent pas votre consentement préalable.
          </p>

          <div className="mt-s-4 overflow-x-auto">
            <table className="w-full text-small border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-s-2 pr-s-4 font-semibold text-ink">Nom</th>
                  <th className="text-left py-s-2 pr-s-4 font-semibold text-ink">Finalité</th>
                  <th className="text-left py-s-2 font-semibold text-ink">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-s-2 pr-s-4 font-mono text-ink-2">sb-session</td>
                  <td className="py-s-2 pr-s-4 text-ink-2">
                    Authentification Supabase — maintien de la session utilisateur chiffrée.
                  </td>
                  <td className="py-s-2 text-ink-2">Durée de la session</td>
                </tr>
                <tr>
                  <td className="py-s-2 pr-s-4 font-mono text-ink-2">csrf-token</td>
                  <td className="py-s-2 pr-s-4 text-ink-2">
                    Protection contre les attaques CSRF (Cross-Site Request Forgery).
                  </td>
                  <td className="py-s-2 text-ink-2">Durée de la session</td>
                </tr>
                <tr>
                  <td className="py-s-2 pr-s-4 font-mono text-ink-2">mk-lang</td>
                  <td className="py-s-2 pr-s-4 text-ink-2">
                    Mémorisation de la préférence de langue de l'interface.
                  </td>
                  <td className="py-s-2 text-ink-2">30 jours</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 data-toc id="analytique" className="text-h2 font-semibold text-ink mb-s-3">
            3. Analytique sans cookie (PostHog)
          </h2>
          <p>
            Pour améliorer continuellement notre service, nous utilisons <strong>PostHog</strong>
            en mode <em>cookieless</em> (sans cookie). Ce mode de fonctionnement nous permet
            de mesurer les usages agrégés de la Plateforme sans déposer d'identifiant persistant
            sur votre terminal.
          </p>
          <p className="mt-s-3">
            PostHog génère un <em>fingerprint</em> anonymisé à partir de caractéristiques
            non identifiantes de votre navigateur (version, langue, résolution d'écran).
            Ce fingerprint ne permet pas de vous identifier personnellement et n'est pas
            croisé avec vos données de compte.
          </p>
          <p className="mt-s-3">
            Vous pouvez vous opposer à cette collecte anonymisée via le bouton « Opt-out
            de l'analytique » accessible dans les paramètres de votre compte ou en envoyant
            votre demande à{' '}
            <a href="mailto:privacy@medikool.sn" className="text-primary hover:underline">
              privacy@medikool.sn
            </a>.
          </p>
        </section>

        <section>
          <h2 data-toc id="pas-de-pub" className="text-h2 font-semibold text-ink mb-s-3">
            4. Ce que nous n'utilisons pas
          </h2>
          <Card className="p-s-4">
            <ul className="space-y-s-2 text-small text-ink-2">
              <li className="flex items-start gap-s-2">
                <span className="text-status-danger font-bold mt-0.5" aria-hidden="true">✕</span>
                <span>Cookies publicitaires ou de retargeting</span>
              </li>
              <li className="flex items-start gap-s-2">
                <span className="text-status-danger font-bold mt-0.5" aria-hidden="true">✕</span>
                <span>Pixels de réseaux sociaux (Facebook Pixel, LinkedIn Insight, etc.)</span>
              </li>
              <li className="flex items-start gap-s-2">
                <span className="text-status-danger font-bold mt-0.5" aria-hidden="true">✕</span>
                <span>Cookies de profilage comportemental à des fins commerciales</span>
              </li>
              <li className="flex items-start gap-s-2">
                <span className="text-status-danger font-bold mt-0.5" aria-hidden="true">✕</span>
                <span>Outils de heat-mapping ou d'enregistrement de sessions</span>
              </li>
            </ul>
          </Card>
        </section>

        <section>
          <h2 data-toc id="bandeau" className="text-h2 font-semibold text-ink mb-s-3">
            5. Bandeau de consentement
          </h2>
          <p>
            Dans la mesure où Medikool n'utilise que des cookies strictement nécessaires
            (exemptés de consentement) et une analytique sans cookie, aucun bandeau de
            consentement complexe n'est imposé à l'utilisateur lors de sa première visite.
            Une information minimale est affichée pour vous informer de l'existence des
            cookies de session.
          </p>
        </section>

        <section>
          <h2 data-toc id="contact-cookies" className="text-h2 font-semibold text-ink mb-s-3">
            6. Contact
          </h2>
          <p>
            Pour toute question relative à notre politique des cookies, contactez-nous à
            l'adresse{' '}
            <a href="mailto:privacy@medikool.sn" className="text-primary hover:underline">
              privacy@medikool.sn
            </a>.
          </p>
        </section>

      </div>
    </LegalLayout>
  )
}
