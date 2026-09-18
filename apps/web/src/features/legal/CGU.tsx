import { LegalLayout } from './LegalLayout'

export const META = {
  title: "Conditions Générales d'Utilisation | Séne Wérr",
  description:
    "Les CGU de Séne Wérr définissent les règles d'utilisation de la plateforme pour les patients, professionnels, pharmacies, établissements et mutuelles.",
}

export default function CGU() {
  return (
    <LegalLayout
      title="Conditions Générales d'Utilisation (CGU)"
      lastUpdated="17 septembre 2026"
    >
      <div className="space-y-s-8 text-body text-ink-2 leading-relaxed">

        <section>
          <h2 data-toc id="objet" className="text-h2 font-semibold text-ink mb-s-3">
            Article 1 — Objet
          </h2>
          <p>
            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et
            l'utilisation de la plateforme <strong>Séne Wérr</strong> (ci-après « la Plateforme »),
            accessible à l'adresse <em>senewerr.com</em> et via ses applications mobiles.
          </p>
          <p className="mt-s-3">
            Séne Wérr est un service numérique de <strong>mise en relation et de coordination</strong>
            entre patients, professionnels de santé, établissements de soins, pharmacies et
            organismes de mutuelle-santé. À ce titre, Séne Wérr n'est <strong>pas un établissement
            de soins</strong> et ne dispense <strong>aucun acte médical</strong>. La responsabilité
            médicale demeure intégralement celle des professionnels de santé et des établissements
            inscrits sur la Plateforme.
          </p>
        </section>

        <section>
          <h2 data-toc id="acceptation" className="text-h2 font-semibold text-ink mb-s-3">
            Article 2 — Acceptation des CGU
          </h2>
          <p>
            L'accès à la Plateforme implique l'acceptation pleine et entière des présentes
            CGU. En créant un compte ou en utilisant les services Séne Wérr, vous reconnaissez
            avoir lu, compris et accepté ces conditions. Les CGU peuvent être modifiées à
            tout moment ; la version en vigueur est celle publiée en ligne avec sa date de
            mise à jour. Les utilisateurs sont informés par email de toute modification
            substantielle.
          </p>
        </section>

        <section>
          <h2 data-toc id="roles" className="text-h2 font-semibold text-ink mb-s-3">
            Article 3 — Rôles et responsabilités des acteurs
          </h2>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">3.1 Patient</h3>
          <p>
            Le patient est responsable de l'exactitude des informations personnelles et
            médicales qu'il communique sur la Plateforme. Il s'engage à ne pas usurper
            l'identité d'un tiers, à utiliser la Plateforme à des fins personnelles et
            licites, et à informer immédiatement Séne Wérr de tout accès non autorisé à
            son compte.
          </p>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">3.2 Professionnel de santé</h3>
          <p>
            Le professionnel de santé exerce à titre libéral ou salarié et demeure
            <strong> seul responsable</strong> de ses actes médicaux, de ses prescriptions
            et des ordonnances qu'il émet via la Plateforme. Il certifie être inscrit à
            l'ordre professionnel compétent et s'engage à maintenir cette inscription à
            jour. La désactivation de son compte interviendra automatiquement si l'inscription
            à l'ordre n'est plus valide.
          </p>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">3.3 Établissement de soins</h3>
          <p>
            L'établissement est responsable de la vérification des accréditations et des
            inscriptions ordinales des membres de son personnel qu'il ajoute à la Plateforme.
            Il s'engage à ne pas inviter des professionnels non habilitées et à signaler
            immédiatement tout départ de personnel ayant accès aux données patients.
          </p>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">3.4 Pharmacie</h3>
          <p>
            La pharmacie est responsable de la <strong>vérification de l'authenticité
            de l'ordonnance</strong> avant toute dispensation, conformément à la réglementation
            pharmaceutique en vigueur. La préparation et la délivrance des médicaments relèvent
            de la seule responsabilité légale du pharmacien titulaire. Séne Wérr met à disposition
            un code QR d'authentification pour faciliter la vérification, sans se substituer
            au contrôle pharmaceutique obligatoire.
          </p>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">3.5 Mutuelle-santé</h3>
          <p>
            L'organisme de mutuelle reste seul décisionnaire de la prise en charge des
            soins et des remboursements selon ses propres règles contractuelles et ses
            tableaux de garanties. Séne Wérr facilite la transmission des justificatifs
            et le suivi des dossiers, mais ne garantit en aucun cas l'accord de prise
            en charge. Les décisions de remboursement relèvent exclusivement de la mutuelle.
          </p>
        </section>

        <section>
          <h2 data-toc id="compte" className="text-h2 font-semibold text-ink mb-s-3">
            Article 4 — Compte utilisateur
          </h2>
          <p>
            La création d'un compte nécessite une vérification de l'adresse email et,
            selon le profil, une vérification du numéro professionnel ou de l'agrément
            de l'établissement. L'utilisateur est responsable de la confidentialité de
            ses identifiants. Séne Wérr se réserve le droit de suspendre ou supprimer
            tout compte en cas de violation des présentes CGU, de fraude avérée ou de
            non-conformité réglementaire.
          </p>
        </section>

        <section>
          <h2 data-toc id="donnees-sante" className="text-h2 font-semibold text-ink mb-s-3">
            Article 5 — Données de santé
          </h2>
          <p>
            Le traitement des données de santé sur la Plateforme requiert le
            <strong> consentement exprès</strong> du patient pour chaque partage avec un
            tiers (professionnel, établissement, pharmacie). Le principe d'
            <strong>accès minimum nécessaire</strong> est appliqué : chaque acteur n'a
            accès qu'aux données strictement indispensables à sa mission. Le patient
            peut retirer son consentement à tout moment depuis son espace personnel,
            ce qui révoque automatiquement les accès accordés.
          </p>
        </section>

        <section>
          <h2 data-toc id="paiements" className="text-h2 font-semibold text-ink mb-s-3">
            Article 6 — Paiements
          </h2>
          <p>
            Les paiements effectués via la Plateforme sont sécurisés par des prestataires
            de services de paiement (PSP) certifiés PCI-DSS : Stripe pour les paiements
            par carte, Wave Mobile Money et Orange Money pour les paiements mobiles. Les
            montants des transactions sont calculés et validés exclusivement côté serveur ;
            aucune donnée de prix ne peut être manipulée côté client. Séne Wérr émet une
            confirmation de paiement électronique pour toute transaction aboutie.
          </p>
        </section>

        <section>
          <h2 data-toc id="ordonnance" className="text-h2 font-semibold text-ink mb-s-3">
            Article 7 — Ordonnance électronique
          </h2>
          <p>
            Une ordonnance émise via Séne Wérr est valable <strong>90 jours</strong> à
            compter de sa date d'émission, dans la limite de la réglementation applicable.
            Elle est <strong>non transmissible</strong> et ne peut faire l'objet que d'un
            seul retrait par le patient auprès de la pharmacie désignée. Toute tentative
            de duplication ou de falsification est considérée comme une fraude et fera
            l'objet d'un signalement aux autorités compétentes.
          </p>
        </section>

        <section>
          <h2 data-toc id="responsabilites" className="text-h2 font-semibold text-ink mb-s-3">
            Article 8 — Responsabilités
          </h2>
          <p>
            Séne Wérr est responsable du bon fonctionnement technique de la Plateforme,
            de la disponibilité du service (sous réserve des maintenances planifiées et
            des causes extérieures), et de la sécurité des données qu'elle héberge.
            Séne Wérr n'est pas responsable des actes professionnels accomplis par les
            utilisateurs inscrits, ni des décisions médicales ou pharmaceutiques prises
            via la Plateforme.
          </p>
          <p className="mt-s-3">
            En cas d'indisponibilité du service due à des causes extérieures (force majeure,
            pannes chez un sous-traitant, cyberattaque), Séne Wérr ne pourra être tenue
            responsable des préjudices en résultant, dans la limite des dispositions
            légales applicables.
          </p>
        </section>

        <section>
          <h2 data-toc id="propriete-intellectuelle" className="text-h2 font-semibold text-ink mb-s-3">
            Article 9 — Propriété intellectuelle
          </h2>
          <p>
            L'ensemble des éléments constitutifs de la Plateforme (logiciels, bases de données,
            interfaces, marques, textes, illustrations) sont la propriété exclusive de Séne Wérr
            SAS ou font l'objet de licences accordées à la société. Toute reproduction,
            extraction, représentation ou exploitation commerciale non autorisée est strictement
            interdite et susceptible de poursuites.
          </p>
        </section>

        <section>
          <h2 data-toc id="resiliation" className="text-h2 font-semibold text-ink mb-s-3">
            Article 10 — Résiliation
          </h2>
          <p>
            L'utilisateur peut résilier son compte à tout moment depuis les paramètres
            de son espace personnel. En cas de fraude avérée, de violation grave des
            présentes CGU ou de mise en danger d'un utilisateur, Séne Wérr se réserve
            le droit de procéder à une résiliation immédiate et sans préavis, sans
            préjudice des poursuites judiciaires éventuelles.
          </p>
        </section>

        <section>
          <h2 data-toc id="loi-applicable" className="text-h2 font-semibold text-ink mb-s-3">
            Article 11 — Loi applicable et juridiction compétente
          </h2>
          <p>
            Les présentes CGU sont régies par le <strong>droit sénégalais</strong>.
            En cas de litige, les parties s'engagent à rechercher une solution amiable
            avant toute action judiciaire. À défaut d'accord amiable, tout litige
            relatif à l'interprétation ou à l'exécution des présentes CGU sera soumis
            à la compétence exclusive des <strong>juridictions de Dakar, Sénégal</strong>.
          </p>
        </section>

      </div>
    </LegalLayout>
  )
}
