import { LegalLayout } from './LegalLayout'

export const META = {
  title: 'Mentions légales | Séne Wérr',
  description:
    "Informations légales sur Séne Wérr : éditeur, hébergeur, contacts et responsabilités.",
}

export default function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales" lastUpdated="17 septembre 2026">
      <section className="space-y-s-6 text-body text-ink-2 leading-relaxed">

        <div>
          <h2 data-toc id="editeur" className="text-h2 font-semibold text-ink mb-s-3">
            1. Éditeur du site
          </h2>
          <p>
            Le site <strong>senewerr.com</strong> est édité par la société <strong>Séne Wérr SAS</strong>,
            (Hypothèse à valider : raison sociale exacte, forme juridique, numéro RCCM et NINEA),
            dont le siège social est situé à Dakar, Sénégal.
          </p>
          <p className="mt-s-3">
            Directeur de la publication : (Hypothèse à valider : nom et prénom du directeur de publication).
          </p>
          <p className="mt-s-3">
            Numéro de téléphone : (Hypothèse à valider) — disponible du lundi au vendredi de 08h à 18h (WAT).
          </p>
          <p className="mt-s-3">
            Adresses électroniques de contact :{' '}
            <a href="mailto:contact@senewerr.com" className="text-primary hover:underline">
              contact@senewerr.com
            </a>{' '}
            (informations générales) ·{' '}
            <a href="mailto:support@senewerr.com" className="text-primary hover:underline">
              support@senewerr.com
            </a>{' '}
            (support technique).
          </p>
        </div>

        <div>
          <h2 data-toc id="hebergement" className="text-h2 font-semibold text-ink mb-s-3">
            2. Hébergement
          </h2>
          <p>
            L'infrastructure technique de Séne Wérr est assurée par{' '}
            <strong>Supabase Inc.</strong>, dont le siège social est situé au 970 Trestle Glen Road,
            Oakland, CA 94610, États-Unis. Les bases de données, services d'authentification et
            stockage de fichiers sont hébergés en région Union Européenne (eu-west-1 / eu-central-1)
            sur l'infrastructure Amazon Web Services (AWS), dans le respect des règles de localisation
            des données applicables.
          </p>
          <p className="mt-s-3">
            Le front-end de l'application est déployé via des services de CDN distribués
            internationalement, garantissant des temps de réponse optimaux pour les utilisateurs
            basés en Afrique de l'Ouest et en Europe.
          </p>
        </div>

        <div>
          <h2 data-toc id="sous-traitants" className="text-h2 font-semibold text-ink mb-s-3">
            3. Sous-traitants et partenaires techniques
          </h2>
          <p>
            Dans le cadre de la fourniture de ses services, Séne Wérr fait appel à plusieurs
            prestataires spécialisés, chacun soumis à des obligations contractuelles strictes en
            matière de confidentialité et de sécurité des données :
          </p>
          <ul className="mt-s-3 list-disc list-inside space-y-s-2">
            <li>
              <strong>Supabase Inc.</strong> — Base de données PostgreSQL et authentification.
              Données hébergées en région UE.
            </li>
            <li>
              <strong>Stripe Inc.</strong> — Traitement des paiements par carte bancaire,
              certifié PCI-DSS niveau 1. Seuls les tokens de paiement sont transmis ; les numéros
              complets de carte ne transitent jamais par les serveurs Séne Wérr.
            </li>
            <li>
              <strong>Wave Mobile Money</strong> — Paiements mobiles pour les utilisateurs
              d'Afrique de l'Ouest.
            </li>
            <li>
              <strong>Orange Money</strong> — Paiements mobiles complémentaires.
            </li>
            <li>
              <strong>Resend Inc.</strong> — Envoi des emails transactionnels (confirmations,
              notifications, récupération de compte).
            </li>
            <li>
              <strong>Sentry Inc.</strong> — Surveillance des erreurs applicatives.
              Les données transmises sont anonymisées et ne contiennent aucune information de santé.
            </li>
            <li>
              <strong>PostHog Inc.</strong> — Analytique produit en mode <em>sans cookie</em>.
              Aucun identifiant persistant n'est déposé sur le terminal de l'utilisateur.
            </li>
          </ul>
        </div>

        <div>
          <h2 data-toc id="activite" className="text-h2 font-semibold text-ink mb-s-3">
            4. Nature de l'activité
          </h2>
          <p>
            Séne Wérr est une <strong>plateforme de mise en relation et de coordination</strong>
            entre patients, professionnels de santé, établissements de soins, pharmacies et
            organismes de mutuelle. À ce titre, Séne Wérr n'est pas un établissement de soins,
            ne délivre pas de consultations médicales et n'intervient pas dans la relation
            thérapeutique entre un patient et son praticien.
          </p>
          <p className="mt-s-3">
            Les professionnels de santé inscrits sur la plateforme exercent à titre libéral
            ou salarié et restent seuls responsables de leurs actes médicaux. Séne Wérr vérifie
            l'inscription des professionnels à leur ordre professionnel compétent lors de
            l'activation de leur compte, mais cette vérification ne constitue pas une garantie
            de qualité des soins.
          </p>
          <p className="mt-s-3">
            Toute suspicion de pratique illégale de la médecine peut être signalée à{' '}
            <a href="mailto:contact@senewerr.com" className="text-primary hover:underline">
              contact@senewerr.com
            </a>.
          </p>
        </div>

        <div>
          <h2 data-toc id="propriete-intellectuelle" className="text-h2 font-semibold text-ink mb-s-3">
            5. Propriété intellectuelle
          </h2>
          <p>
            L'ensemble des contenus présents sur senewerr.com — logotype, interface graphique,
            textes, illustrations, base de données — sont la propriété exclusive de Séne Wérr SAS
            ou font l'objet d'une licence accordée à la société. Toute reproduction, représentation
            ou diffusion sans autorisation préalable écrite est interdite.
          </p>
        </div>

        <div>
          <h2 data-toc id="donnees-personnelles" className="text-h2 font-semibold text-ink mb-s-3">
            6. Données personnelles
          </h2>
          <p>
            La collecte et le traitement des données personnelles des utilisateurs sont régis
            par la{' '}
            <a href="/confidentialite" className="text-primary hover:underline">
              Politique de confidentialité
            </a>{' '}
            de Séne Wérr, conforme à la loi n° 2008-12 du 25 janvier 2008 portant sur la
            Protection des Données à Caractère Personnel au Sénégal (loi CDP) et au Règlement
            Général sur la Protection des Données (RGPD) pour les utilisateurs résidant dans
            l'Union Européenne.
          </p>
        </div>

      </section>
    </LegalLayout>
  )
}
