import { LegalLayout } from './LegalLayout'

export const META = {
  title: 'Conditions Générales de Vente | Séne Wérr',
  description:
    "Les CGV de Séne Wérr détaillent les plans tarifaires, essai gratuit, abonnements, facturation et politique de remboursement.",
}

export default function CGV() {
  return (
    <LegalLayout
      title="Conditions Générales de Vente (CGV)"
      lastUpdated="17 septembre 2026"
    >
      <div className="space-y-s-8 text-body text-ink-2 leading-relaxed">

        <section>
          <h2 data-toc id="plans" className="text-h2 font-semibold text-ink mb-s-3">
            Article 1 — Plans et tarifs
          </h2>
          <p>
            Les plans tarifaires de Séne Wérr sont disponibles en détail sur la page{' '}
            <a href="/tarifs" className="text-primary hover:underline">/tarifs</a>.
            Tous les prix sont exprimés en <strong>francs CFA (FCFA) toutes taxes comprises
            (TTC)</strong>, sauf mention contraire. Séne Wérr propose des offres distinctes
            pour les professionnels de santé indépendants, les établissements de soins,
            les pharmacies et les organismes de mutuelle-santé.
          </p>
          <p className="mt-s-3">
            Les patients bénéficient d'un accès gratuit à la Plateforme. Seuls les
            acteurs professionnels (professionnels de santé, établissements, pharmacies,
            mutuelles) sont soumis à un abonnement payant pour accéder aux fonctionnalités
            avancées de gestion.
          </p>
        </section>

        <section>
          <h2 data-toc id="essai" className="text-h2 font-semibold text-ink mb-s-3">
            Article 2 — Essai gratuit
          </h2>
          <p>
            Tout nouveau compte professionnel (professionnel de santé, établissement,
            pharmacie, mutuelle) bénéficie d'un <strong>essai gratuit de 14 jours</strong>
            donnant accès à l'ensemble des fonctionnalités du plan souscrit,
            <strong> sans nécessité de renseigner un moyen de paiement</strong> lors
            de l'inscription. À l'issue de la période d'essai, un moyen de paiement
            valide est requis pour poursuivre l'utilisation des fonctionnalités payantes.
          </p>
          <p className="mt-s-3">
            L'essai gratuit est accordé une seule fois par entité juridique et ne peut
            être utilisé pour tester plusieurs comptes distincts de manière frauduleuse.
          </p>
        </section>

        <section>
          <h2 data-toc id="abonnement" className="text-h2 font-semibold text-ink mb-s-3">
            Article 3 — Abonnement
          </h2>
          <p>
            L'abonnement Séne Wérr est disponible en formule <strong>mensuelle</strong> ou
            <strong> annuelle</strong>. La formule annuelle offre l'équivalent de deux mois
            d'abonnement offerts par rapport au tarif mensuel (soit une économie d'environ
            16 %). Le choix de la période de facturation est effectué lors de la souscription
            et peut être modifié à l'occasion du prochain renouvellement.
          </p>
          <p className="mt-s-3">
            L'abonnement se renouvelle <strong>automatiquement</strong> à échéance, par
            prélèvement sur le moyen de paiement enregistré. Une notification par email
            est envoyée 7 jours avant chaque renouvellement annuel. L'utilisateur peut
            désactiver le renouvellement automatique à tout moment depuis son espace
            de facturation.
          </p>
        </section>

        <section>
          <h2 data-toc id="resiliation" className="text-h2 font-semibold text-ink mb-s-3">
            Article 4 — Résiliation de l'abonnement
          </h2>
          <p>
            L'abonné peut résilier son abonnement à tout moment depuis les paramètres
            de son compte, rubrique « Facturation ». La résiliation prend effet à la
            <strong> fin de la période d'abonnement en cours</strong> : l'accès aux
            fonctionnalités payantes est maintenu jusqu'à cette date, sans remboursement
            au prorata des jours restants (sauf dans les conditions prévues à l'article 5).
          </p>
          <p className="mt-s-3">
            Aucun préavis minimum n'est exigé pour la résiliation mensuelle. Pour la
            résiliation d'un abonnement annuel, l'utilisateur est invité à résilier
            au plus tard la veille de la date de renouvellement pour éviter la facturation
            de la période suivante.
          </p>
        </section>

        <section>
          <h2 data-toc id="remboursement" className="text-h2 font-semibold text-ink mb-s-3">
            Article 5 — Politique de remboursement des abonnements
          </h2>
          <p>
            Un remboursement intégral de l'abonnement peut être accordé dans un délai de
            <strong> 14 jours calendaires</strong> à compter de la date de débit, sous
            réserve que l'utilisation effective du service soit nulle sur la période
            concernée, définie comme l'absence de toute :
          </p>
          <ul className="mt-s-3 list-disc list-inside space-y-s-1">
            <li>réservation ou rendez-vous créé ou accepté ;</li>
            <li>ordonnance émise ou traitée ;</li>
            <li>appel à l'assistant IA.</li>
          </ul>
          <p className="mt-s-3">
            Au-delà de ce délai de 14 jours ou en cas d'utilisation avérée,
            <strong> aucun remboursement au prorata</strong> ne sera accordé.
            Pour toute demande de remboursement dans le délai, contactez{' '}
            <a href="mailto:contact@senewerr.com" className="text-primary hover:underline">
              contact@senewerr.com
            </a>{' '}
            en précisant votre identifiant de compte et le motif de la demande.
          </p>
        </section>

        <section>
          <h2 data-toc id="commissions" className="text-h2 font-semibold text-ink mb-s-3">
            Article 6 — Commissions
          </h2>
          <p>
            Pour les pharmacies, une commission est prélevée sur le montant hors taxes
            de chaque réservation traitée via la Plateforme. Le taux de commission varie
            selon le plan souscrit et est précisé sur la page{' '}
            <a href="/tarifs" className="text-primary hover:underline">/tarifs</a>.
            La commission est déduite automatiquement avant le versement sur le compte
            de la pharmacie ou facturée mensuellement, selon la configuration du compte.
          </p>
        </section>

        <section>
          <h2 data-toc id="facturation" className="text-h2 font-semibold text-ink mb-s-3">
            Article 7 — Facturation
          </h2>
          <p>
            Une facture conforme est émise automatiquement à chaque renouvellement
            d'abonnement et à chaque transaction de commission. Les factures sont
            accessibles à tout moment depuis l'espace compte, rubrique « Facturation »,
            et peuvent être téléchargées au format PDF. Elles sont également envoyées
            par email à l'adresse associée au compte.
          </p>
        </section>

        <section>
          <h2 data-toc id="defaut-paiement" className="text-h2 font-semibold text-ink mb-s-3">
            Article 8 — Défaut de paiement
          </h2>
          <p>
            En cas d'échec du prélèvement automatique, Séne Wérr envoie une notification
            par email et tente un nouveau prélèvement après 3 jours. Si le paiement
            n'est pas régularisé dans un délai de <strong>7 jours</strong> suivant la
            première tentative infructueuse, l'accès aux fonctionnalités payantes est
            suspendu. Le compte et les données sont conservés pendant 30 jours
            supplémentaires. Passé ce délai sans régularisation, l'abonnement est
            résilié et le compte archivé conformément à la politique de conservation
            des données.
          </p>
        </section>

        <section>
          <h2 data-toc id="modification-tarifs" className="text-h2 font-semibold text-ink mb-s-3">
            Article 9 — Modification des tarifs
          </h2>
          <p>
            Séne Wérr se réserve le droit de modifier ses tarifs avec un préavis de
            <strong> 30 jours</strong>, communiqué par email à l'adresse enregistrée
            sur le compte. En cas de désaccord avec les nouveaux tarifs, l'utilisateur
            peut résilier son abonnement avant l'entrée en vigueur des nouvelles conditions.
            L'absence de résiliation dans ce délai vaut acceptation des nouveaux tarifs.
          </p>
        </section>

      </div>
    </LegalLayout>
  )
}
