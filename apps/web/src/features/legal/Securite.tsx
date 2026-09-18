import { LegalLayout } from './LegalLayout'
import { Card } from '@/components/ui/Card'
import { Banner } from '@/components/ui/Banner'
import { Lock, Server, UserCheck, Bug, AlertTriangle } from 'lucide-react'

export const META = {
  title: 'Sécurité | Séne Wérr',
  description:
    "Découvrez comment Séne Wérr protège vos données : chiffrement, authentification, hébergement sécurisé et programme de signalement responsable.",
}

export default function Securite() {
  return (
    <LegalLayout title="Sécurité de la plateforme" lastUpdated="17 septembre 2026">
      <div className="space-y-s-8 text-body text-ink-2 leading-relaxed">

        <section>
          <p>
            La sécurité de vos données est au cœur de la conception de Séne Wérr. En tant
            que plateforme manipulant des données de santé, nous appliquons les standards
            de sécurité les plus élevés disponibles, suivons les recommandations de l'ANSSI
            et de l'OWASP, et investissons en permanence dans l'amélioration de notre
            posture de sécurité.
          </p>
        </section>

        <section>
          <h2 data-toc id="chiffrement" className="text-h2 font-semibold text-ink mb-s-4">
            1. Chiffrement des données
          </h2>
          <div className="flex items-start gap-s-3 mb-s-3">
            <Lock className="h-5 w-5 shrink-0 text-primary mt-1" aria-hidden="true" />
            <p>
              Toutes les communications entre votre navigateur ou application mobile et
              nos serveurs sont chiffrées avec le protocole <strong>TLS 1.3</strong>,
              la version la plus récente et la plus sécurisée du standard. Les versions
              antérieures (TLS 1.0 et 1.1) sont désactivées sur l'ensemble de notre
              infrastructure.
            </p>
          </div>
          <p>
            Les données au repos — bases de données, sauvegardes, fichiers — sont
            chiffrées avec l'algorithme <strong>AES-256</strong>. Les données de santé
            (ordonnances, dossiers médicaux) bénéficient d'un chiffrement supplémentaire
            au niveau applicatif, garantissant qu'elles restent illisibles même en cas
            d'accès non autorisé à la couche de stockage.
          </p>
          <p className="mt-s-3">
            Les secrets d'application (clés API, tokens de service) sont stockés dans
            un gestionnaire de secrets dédié et ne sont jamais codés en dur dans le code
            source ni exposés dans les journaux d'application.
          </p>
        </section>

        <section>
          <h2 data-toc id="authentification" className="text-h2 font-semibold text-ink mb-s-4">
            2. Authentification
          </h2>
          <p>
            L'authentification est gérée par Supabase Auth, qui implémente les standards
            OAuth 2.0 et PKCE pour les flux d'authentification web et mobile. Les mots
            de passe sont hachés avec bcrypt (coût 12) et ne sont jamais stockés en clair.
          </p>
          <ul className="mt-s-3 list-disc list-inside space-y-s-2">
            <li>
              <strong>Double authentification (2FA) obligatoire</strong> pour tous les
              administrateurs de la plateforme et les comptes à accès étendu.
            </li>
            <li>
              <strong>2FA optionnelle</strong> pour tous les professionnels de santé,
              fortement recommandée compte tenu de la sensibilité des données manipulées.
            </li>
            <li>
              <strong>Sessions automatiquement révoquées</strong> après 8 heures d'inactivité
              pour les profils professionnels, 30 jours pour les profils patients avec
              option « rester connecté ».
            </li>
            <li>
              <strong>Limitation du taux de requêtes (rate limiting)</strong> sur tous
              les endpoints d'authentification pour prévenir les attaques par force brute.
            </li>
          </ul>
        </section>

        <section>
          <h2 data-toc id="hebergement" className="text-h2 font-semibold text-ink mb-s-4">
            3. Hébergement et infrastructure
          </h2>
          <div className="flex items-start gap-s-3 mb-s-3">
            <Server className="h-5 w-5 shrink-0 text-primary mt-1" aria-hidden="true" />
            <p>
              Notre infrastructure est hébergée sur <strong>Amazon Web Services (AWS)</strong>
              en région européenne (<code>eu-west-1</code> / <code>eu-central-1</code>),
              via Supabase. AWS est certifié ISO 27001, SOC 2 Type II et PCI-DSS,
              garantissant des standards de sécurité physique et logique de premier ordre.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-s-2">
            <li>Sauvegardes automatiques quotidiennes avec rétention de 30 jours.</li>
            <li>
              Journaux d'audit (audit logs) immuables enregistrant tous les accès aux
              données de santé, conservés 12 mois.
            </li>
            <li>Monitoring de disponibilité 24/7 avec alertes en temps réel.</li>
            <li>
              Séparation des environnements de production, de staging et de développement :
              les données de production ne sont jamais utilisées dans les environnements
              non-production.
            </li>
          </ul>
        </section>

        <section>
          <h2 data-toc id="verification" className="text-h2 font-semibold text-ink mb-s-4">
            4. Vérification des acteurs
          </h2>
          <div className="flex items-start gap-s-3 mb-s-3">
            <UserCheck className="h-5 w-5 shrink-0 text-primary mt-1" aria-hidden="true" />
            <p>
              Séne Wérr procède à la vérification de l'identité et des accréditations
              de chaque acteur professionnel avant l'activation de son compte :
            </p>
          </div>
          <ul className="list-disc list-inside space-y-s-2">
            <li>Vérification de l'inscription à l'ordre professionnel compétent pour les praticiens.</li>
            <li>Vérification du numéro d'agrément pour les établissements de soins.</li>
            <li>Vérification de l'autorisation d'exploitation pour les pharmacies.</li>
            <li>Vérification de l'agrément du Ministère de la Santé pour les mutuelles.</li>
          </ul>
          <p className="mt-s-3">
            Ces vérifications sont répétées périodiquement et lors de tout changement
            détecté (expiration, radiation). Un compte dont les accréditations ne peuvent
            être confirmées est automatiquement suspendu jusqu'à régularisation.
          </p>
        </section>

        <section>
          <h2 data-toc id="audit" className="text-h2 font-semibold text-ink mb-s-4">
            5. Audits de sécurité
          </h2>
          <p>
            Séne Wérr réalise régulièrement des tests de sécurité internes : revues de code,
            scans de vulnérabilités automatisés, tests d'intrusion sur les API critiques.
            Un audit de sécurité externe par un prestataire indépendant est prévu
            (Hypothèse à valider : planning et prestataire de l'audit externe). Les
            résultats de ces audits sont utilisés pour améliorer continuellement notre
            posture de sécurité.
          </p>
        </section>

        <section>
          <h2 data-toc id="signalement" className="text-h2 font-semibold text-ink mb-s-4">
            6. Signalement responsable (Responsible Disclosure)
          </h2>
          <div className="flex items-start gap-s-3 mb-s-3">
            <Bug className="h-5 w-5 shrink-0 text-primary mt-1" aria-hidden="true" />
            <div>
              <p>
                Si vous découvrez une vulnérabilité de sécurité sur la plateforme Séne Wérr,
                nous vous encourageons à nous la signaler de manière responsable avant
                toute divulgation publique.
              </p>
            </div>
          </div>

          <Banner kind="warning">
            <span>
              <strong>Politique de non-divulgation :</strong> merci de ne pas publier
              ni partager les détails de la vulnérabilité avant que nous ayons pu la
              corriger et vous informer de la résolution.
            </span>
          </Banner>

          <div className="mt-s-4">
            <p>Pour signaler une vulnérabilité :</p>
            <ul className="mt-s-2 list-disc list-inside space-y-s-2">
              <li>
                Envoyez un email à{' '}
                <a href="mailto:security@senewerr.com" className="text-primary hover:underline">
                  security@senewerr.com
                </a>{' '}
                en décrivant la vulnérabilité, les étapes pour la reproduire et l'impact
                potentiel estimé.
              </li>
              <li>
                Nous accuserons réception de votre signalement sous{' '}
                <strong>48 heures ouvrées</strong>.
              </li>
              <li>
                Nous vous informerons de l'avancement de la correction et de la date
                de résolution prévue.
              </li>
              <li>
                Les chercheurs en sécurité agissant de bonne foi ne feront l'objet
                d'aucune poursuite judiciaire.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 data-toc id="bug-bounty" className="text-h2 font-semibold text-ink mb-s-4">
            7. Programme de primes (Bug Bounty)
          </h2>
          <Card className="p-s-4">
            <div className="flex items-start gap-s-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-accent mt-0.5" aria-hidden="true" />
              <p className="text-small text-ink-2">
                Un programme de Bug Bounty formel est en cours de lancement
                (Hypothèse à valider : plateforme et barème de récompenses). En attendant
                son ouverture officielle, tous les signalements responsables reçus à{' '}
                <a href="mailto:security@senewerr.com" className="text-primary hover:underline">
                  security@senewerr.com
                </a>{' '}
                seront examinés et reconnus.
              </p>
            </div>
          </Card>
        </section>

        <section>
          <p className="text-small text-ink-3">
            Pour en savoir plus sur la façon dont nous protégeons vos données personnelles,
            consultez notre{' '}
            <a href="/confidentialite" className="text-primary hover:underline">
              Politique de confidentialité
            </a>.
          </p>
        </section>

      </div>
    </LegalLayout>
  )
}
