import { LegalLayout } from './LegalLayout'

export const META = {
  title: 'Politique de confidentialité | Séne Wérr',
  description:
    "Comment Séne Wérr collecte, utilise et protège vos données personnelles, dont les données de santé.",
}

export default function PolitiqueConfidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité" lastUpdated="17 septembre 2026">
      <div className="space-y-s-8 text-body text-ink-2 leading-relaxed">

        <section>
          <h2 data-toc id="responsable" className="text-h2 font-semibold text-ink mb-s-3">
            1. Responsable du traitement
          </h2>
          <p>
            Le responsable du traitement de vos données personnelles est{' '}
            <strong>Séne Wérr SAS</strong>, dont le siège social est à Dakar, Sénégal.
            Pour toute question relative à la protection de vos données, vous pouvez contacter
            notre Délégué à la Protection des Données (DPO) à l'adresse suivante :{' '}
            <a href="mailto:dpo@senewerr.com" className="text-primary hover:underline">
              dpo@senewerr.com
            </a>.
          </p>
          <p className="mt-s-3">
            Séne Wérr traite vos données dans le respect de la loi sénégalaise n° 2008-12 du
            25 janvier 2008 sur la Protection des Données à Caractère Personnel (loi CDP),
            administrée par la Commission des Données Personnelles (CDP), et du Règlement
            Général sur la Protection des Données (RGPD) de l'Union Européenne pour les
            utilisateurs résidant en Europe.
          </p>
        </section>

        <section>
          <h2 data-toc id="donnees-collectees" className="text-h2 font-semibold text-ink mb-s-3">
            2. Données collectées
          </h2>
          <p>Nous collectons les catégories de données suivantes selon votre profil et votre utilisation :</p>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">Données d'identité et de contact</h3>
          <p>
            Nom, prénom, date de naissance, numéro de téléphone, adresse email, numéro
            d'identification professionnelle (pour les praticiens), adresse postale
            (facultative). Ces données sont collectées lors de la création de votre compte
            et peuvent être mises à jour à tout moment.
          </p>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">Données de santé</h3>
          <p>
            Pour les patients : ordonnances (numéro, médicaments prescrits, posologie,
            durée), historique des commandes pharmaceutiques, dossier de suivi partagé avec
            les professionnels de santé autorisés par le patient. Ces données relèvent de
            la catégorie des <em>données sensibles</em> au sens de l'article 9 du RGPD et
            de l'article 4 de la loi CDP sénégalaise. Leur traitement repose sur votre
            consentement explicite et, le cas échéant, sur la protection des intérêts vitaux
            conformément à l'article 9 §2 c) du RGPD.
          </p>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">Données de paiement</h3>
          <p>
            Montants des transactions, méthode de paiement (carte bancaire, Wave, Orange Money),
            statut et horodatage. Les numéros complets de carte bancaire ne sont jamais
            enregistrés sur nos serveurs ; seuls les tokens sécurisés fournis par nos
            prestataires de paiement certifiés PCI-DSS sont conservés.
          </p>

          <h3 className="text-h3 font-semibold text-ink mt-s-4 mb-s-2">Données de connexion et journaux</h3>
          <p>
            Adresse IP, horodatage des connexions, type et version du navigateur, système
            d'exploitation, pages consultées. Ces données sont conservées 12 mois à des fins
            de sécurité et de détection des accès frauduleux.
          </p>
        </section>

        <section>
          <h2 data-toc id="finalites" className="text-h2 font-semibold text-ink mb-s-3">
            3. Finalités et bases légales
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-small border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-s-2 pr-s-4 font-semibold text-ink">Finalité</th>
                  <th className="text-left py-s-2 pr-s-4 font-semibold text-ink">Base légale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[
                  ['Création et gestion du compte utilisateur', 'Exécution du contrat (art. 6 §1 b RGPD)'],
                  ['Mise en relation patient / professionnel / pharmacie', 'Exécution du contrat'],
                  ['Traitement des paiements', 'Exécution du contrat'],
                  ['Gestion des ordonnances et données de santé', 'Consentement explicite (art. 9 §2 a RGPD)'],
                  ['Surveillance de la sécurité et prévention de la fraude', 'Intérêt légitime (art. 6 §1 f RGPD)'],
                  ['Envoi d\'emails transactionnels', 'Exécution du contrat'],
                  ['Analytique produit anonymisée (PostHog)', 'Intérêt légitime'],
                  ['Obligations comptables et fiscales', 'Obligation légale (art. 6 §1 c RGPD)'],
                  ['Communications marketing (avec opt-in)', 'Consentement'],
                ].map(([finalite, base]) => (
                  <tr key={finalite}>
                    <td className="py-s-2 pr-s-4 text-ink-2">{finalite}</td>
                    <td className="py-s-2 text-ink-2">{base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 data-toc id="durees" className="text-h2 font-semibold text-ink mb-s-3">
            4. Durées de conservation
          </h2>
          <ul className="list-disc list-inside space-y-s-2">
            <li>
              <strong>Dossier de santé et ordonnances :</strong> 10 ans à compter de la
              dernière interaction, conformément aux obligations légales de conservation
              des dossiers médicaux.
            </li>
            <li>
              <strong>Journaux de connexion et logs de sécurité :</strong> 12 mois.
            </li>
            <li>
              <strong>Données de paiement et factures :</strong> 10 ans (obligation
              comptable légale).
            </li>
            <li>
              <strong>Données marketing et préférences de communication :</strong> 3 ans
              à compter du dernier contact actif.
            </li>
            <li>
              <strong>Données de compte inactif :</strong> Le compte est archivé après
              24 mois d'inactivité et supprimé définitivement après 36 mois, sauf
              obligation légale de conservation plus longue.
            </li>
          </ul>
          <p className="mt-s-3">
            À l'issue des durées de conservation, les données sont supprimées ou
            anonymisées de manière irréversible.
          </p>
        </section>

        <section>
          <h2 data-toc id="sous-traitants" className="text-h2 font-semibold text-ink mb-s-3">
            5. Sous-traitants
          </h2>
          <p>
            Nous recourons à des sous-traitants soigneusement sélectionnés, liés par des
            accords de traitement des données (DPA) conformes au RGPD :
          </p>
          <ul className="mt-s-3 list-disc list-inside space-y-s-2">
            <li>
              <strong>Supabase Inc.</strong> (États-Unis) — Hébergement base de données et
              authentification. Données localisées en région UE via AWS. DPA signé incluant
              les Clauses Contractuelles Types (CCT) de la Commission Européenne.
            </li>
            <li>
              <strong>Stripe Inc.</strong> (États-Unis) — Traitement des paiements.
              Données minimisées aux informations strictement nécessaires à la transaction.
            </li>
            <li>
              <strong>Wave Mobile Money</strong> — Paiements mobiles. Traitement local
              en Afrique de l'Ouest.
            </li>
            <li>
              <strong>Orange Money</strong> — Paiements mobiles complémentaires.
            </li>
            <li>
              <strong>OpenAI Inc.</strong> (États-Unis) — Fonctionnalités d'assistance
              par intelligence artificielle. Les données transmises sont minimisées :
              aucune donnée d'identification directe n'est incluse dans les requêtes.
              Un DPA signé avec OpenAI inclut explicitement l'opt-out de l'entraînement
              des modèles sur nos données.
            </li>
            <li>
              <strong>Resend Inc.</strong> — Envoi des emails transactionnels. Seuls
              l'adresse email du destinataire et le contenu de l'email sont transmis.
            </li>
            <li>
              <strong>Sentry Inc.</strong> — Surveillance des erreurs. Les données de
              journalisation sont anonymisées et ne contiennent aucune donnée de santé.
            </li>
            <li>
              <strong>PostHog Inc.</strong> — Analytique produit en mode sans cookie.
              Aucun identifiant persistant n'est déposé sur votre terminal.
            </li>
          </ul>
        </section>

        <section>
          <h2 data-toc id="droits" className="text-h2 font-semibold text-ink mb-s-3">
            6. Vos droits
          </h2>
          <p>
            Conformément à la loi CDP sénégalaise et au RGPD, vous disposez des droits
            suivants concernant vos données personnelles :
          </p>
          <ul className="mt-s-3 list-disc list-inside space-y-s-2">
            <li><strong>Droit d'accès :</strong> obtenir une copie de vos données.</li>
            <li><strong>Droit de rectification :</strong> corriger des données inexactes.</li>
            <li>
              <strong>Droit d'opposition :</strong> vous opposer au traitement fondé sur
              l'intérêt légitime.
            </li>
            <li>
              <strong>Droit à l'effacement :</strong> demander la suppression de vos
              données (sous réserve des obligations légales de conservation).
            </li>
            <li>
              <strong>Droit à la portabilité :</strong> recevoir vos données dans un
              format structuré et lisible par machine.
            </li>
            <li>
              <strong>Droit de retrait du consentement :</strong> à tout moment, sans
              que cela ne remette en cause la licéité des traitements antérieurs.
            </li>
          </ul>
          <p className="mt-s-3">
            Pour exercer ces droits, adressez votre demande à{' '}
            <a href="mailto:dpo@senewerr.com" className="text-primary hover:underline">
              dpo@senewerr.com
            </a>{' '}
            ou par courrier à notre siège social. Nous nous engageons à répondre dans un
            délai de <strong>30 jours</strong>.
          </p>
          <p className="mt-s-3">
            En cas de réponse insatisfaisante, vous pouvez introduire une réclamation
            auprès de la <strong>Commission des Données Personnelles (CDP) du Sénégal</strong>{' '}
            via{' '}
            <a
              href="https://www.cdp.sn"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.cdp.sn
            </a>
            . Les utilisateurs résidant dans l'Union Européenne peuvent également saisir
            la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés).
          </p>
        </section>

        <section>
          <h2 data-toc id="sante" className="text-h2 font-semibold text-ink mb-s-3">
            7. Protection renforcée des données de santé
          </h2>
          <p>
            Les données de santé bénéficient d'un niveau de protection renforcé au sein
            de notre infrastructure. Elles sont chiffrées au repos avec l'algorithme
            AES-256 et en transit via TLS 1.3. L'accès à ces données est strictement
            limité aux personnes habilitées (patient, professionnel désigné, pharmacie
            choisie) et journalisé dans un audit log immuable.
          </p>
          <p className="mt-s-3">
            Une ordonnance n'est accessible qu'au <strong>patient émetteur</strong>,
            au <strong>prescripteur</strong> et à la <strong>pharmacie expressément
            désignée</strong> par le patient. Cette désignation requiert un
            <strong> consentement exprès</strong>, valable 48 heures et révocable à tout
            moment depuis l'espace patient. À l'issue de la dispensation ou de l'expiration,
            l'accès de la pharmacie est automatiquement révoqué.
          </p>
          <p className="mt-s-3">
            Lors de la suppression d'un compte, les données de santé sont anonymisées
            de façon irréversible dans les 30 jours, sous réserve des durées légales
            de conservation qui s'appliquent alors à des données pseudonymisées.
          </p>
        </section>

        <section>
          <h2 data-toc id="transferts" className="text-h2 font-semibold text-ink mb-s-3">
            8. Transferts hors Union Européenne
          </h2>
          <p>
            Certains de nos sous-traitants sont établis aux États-Unis. Ces transferts
            sont encadrés par des <strong>Clauses Contractuelles Types (CCT)</strong>
            adoptées par la Commission Européenne, garantissant un niveau de protection
            équivalent à celui du RGPD :
          </p>
          <ul className="mt-s-3 list-disc list-inside space-y-s-2">
            <li>
              <strong>AWS / Supabase :</strong> CCT signées ; données localisées
              en région UE (eu-west-1 / eu-central-1).
            </li>
            <li>
              <strong>OpenAI :</strong> CCT signées ; DPA incluant opt-out de
              l'entraînement des modèles.
            </li>
          </ul>
        </section>

        <section>
          <h2 data-toc id="cookies" className="text-h2 font-semibold text-ink mb-s-3">
            9. Cookies et traceurs
          </h2>
          <p>
            Séne Wérr utilise uniquement des cookies techniques strictement nécessaires
            au fonctionnement du service (session, protection CSRF). L'outil d'analytique
            PostHog est configuré en mode <em>sans cookie</em> : aucun identifiant
            persistant n'est déposé sur votre terminal. Pour plus d'informations,
            consultez notre{' '}
            <a href="/cookies" className="text-primary hover:underline">
              Politique des cookies
            </a>.
          </p>
        </section>

        <section>
          <h2 data-toc id="contact-dpo" className="text-h2 font-semibold text-ink mb-s-3">
            10. Contact DPO
          </h2>
          <p>
            Pour toute question relative à la protection de vos données personnelles,
            contactez notre Délégué à la Protection des Données :{' '}
            <a href="mailto:dpo@senewerr.com" className="text-primary hover:underline">
              dpo@senewerr.com
            </a>
            . Nous nous engageons à accuser réception sous 72 heures et à répondre
            dans les 30 jours.
          </p>
        </section>

      </div>
    </LegalLayout>
  )
}
