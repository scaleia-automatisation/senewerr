import { LegalLayout } from './LegalLayout'
import { Banner } from '@/components/ui/Banner'

export const META = {
  title: 'Politique de remboursement | Medikool',
  description:
    "Conditions et délais de remboursement des commandes pharmaceutiques sur Medikool.",
}

export default function Remboursements() {
  return (
    <LegalLayout title="Politique de remboursement" lastUpdated="17 septembre 2026">
      <div className="space-y-s-8 text-body text-ink-2 leading-relaxed">

        <Banner kind="info">
          Les remboursements automatiques sont traités sans démarche de votre part.
          Seuls les cas non couverts nécessitent une demande explicite.
        </Banner>

        <section>
          <h2 data-toc id="remboursements-auto" className="text-h2 font-semibold text-ink mb-s-3">
            1. Remboursements automatiques
          </h2>
          <p>
            Medikool procède automatiquement au remboursement intégral du montant payé
            par le patient dans les cas suivants, sans qu'aucune démarche de votre part
            ne soit nécessaire :
          </p>
          <ul className="mt-s-3 list-disc list-inside space-y-s-2">
            <li>
              <strong>Annulation avant préparation :</strong> le patient annule sa commande
              avant que la pharmacie n'ait commencé la préparation des médicaments.
            </li>
            <li>
              <strong>Refus de la pharmacie :</strong> la pharmacie refuse ou est dans
              l'impossibilité de traiter l'ordonnance (rupture de stock totale, ordonnance
              non conforme après vérification du pharmacien).
            </li>
            <li>
              <strong>Refus de prise en charge par la mutuelle :</strong> la mutuelle refuse
              la prise en charge et le patient avait payé en avance la totalité du montant.
            </li>
            <li>
              <strong>Non-confirmation sous 24 heures :</strong> la pharmacie n'a pas confirmé
              la commande dans le délai imparti de 24 heures à compter de la réception.
            </li>
            <li>
              <strong>Expiration de commande :</strong> la commande expire avant d'être
              traitée (ordonnance arrivée à échéance pendant le processus de commande).
            </li>
          </ul>
          <p className="mt-s-3">
            Le remboursement automatique est déclenché dans un délai de 2 heures suivant
            l'événement déclencheur. Vous recevrez une notification par email et via
            l'application.
          </p>
        </section>

        <section>
          <h2 data-toc id="remboursement-partiel" className="text-h2 font-semibold text-ink mb-s-3">
            2. Remboursement partiel
          </h2>
          <p>
            Dans le cas où un patient a réglé la totalité du montant (part mutuelle
            incluse) et que la mutuelle refuse sa prise en charge après la dispensation,
            la <strong>part patient</strong> (sa quote-part habituelle) ne fait pas l'objet
            d'un remboursement. En revanche, si le patient avait avancé la part normalement
            à la charge de la mutuelle, ce montant lui est remboursé automatiquement
            dès confirmation du refus de la mutuelle.
          </p>
        </section>

        <section>
          <h2 data-toc id="delais" className="text-h2 font-semibold text-ink mb-s-3">
            3. Délais de remboursement selon le mode de paiement
          </h2>

          <div className="mt-s-3 overflow-x-auto">
            <table className="w-full text-small border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-s-2 pr-s-4 font-semibold text-ink">Mode de paiement</th>
                  <th className="text-left py-s-2 font-semibold text-ink">Délai de remboursement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-s-2 pr-s-4 text-ink-2">Wave Mobile Money</td>
                  <td className="py-s-2 text-ink-2">48 heures</td>
                </tr>
                <tr>
                  <td className="py-s-2 pr-s-4 text-ink-2">Orange Money</td>
                  <td className="py-s-2 text-ink-2">72 heures</td>
                </tr>
                <tr>
                  <td className="py-s-2 pr-s-4 text-ink-2">Carte bancaire (Stripe)</td>
                  <td className="py-s-2 text-ink-2">5 à 7 jours ouvrés</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-s-3 text-small text-ink-3">
            Ces délais sont indicatifs et peuvent varier selon les établissements financiers.
            Le remboursement est crédité sur le même moyen de paiement utilisé lors de la
            transaction initiale.
          </p>
        </section>

        <section>
          <h2 data-toc id="demande-manuelle" className="text-h2 font-semibold text-ink mb-s-3">
            4. Demande de remboursement non automatique
          </h2>
          <p>
            Pour les situations non couvertes par le remboursement automatique (litige
            ou cas particulier), vous disposez d'un délai de <strong>30 jours</strong>
            à compter de la transaction pour soumettre une demande de remboursement via :
          </p>
          <ul className="mt-s-3 list-disc list-inside space-y-s-2">
            <li>
              Le formulaire « Demander un remboursement » accessible depuis la rubrique
              <strong> Mes commandes</strong> de votre espace patient.
            </li>
            <li>
              Par email à{' '}
              <a href="mailto:contact@medikool.sn" className="text-primary hover:underline">
                contact@medikool.sn
              </a>{' '}
              en précisant votre numéro de commande et le motif de la demande.
            </li>
          </ul>
          <p className="mt-s-3">
            Toute demande reçue après le délai de 30 jours sera traitée à titre
            exceptionnel, selon l'appréciation de notre équipe support.
          </p>
        </section>

        <section>
          <h2 data-toc id="abonnements" className="text-h2 font-semibold text-ink mb-s-3">
            5. Remboursement des abonnements
          </h2>
          <p>
            Les conditions de remboursement des abonnements professionnels sont définies
            à l'<a href="/cgv#remboursement" className="text-primary hover:underline">Article 5
            des Conditions Générales de Vente</a>. En résumé : remboursement possible dans
            les 14 jours si aucune utilisation n'a été constatée ; aucun remboursement
            au prorata au-delà.
          </p>
        </section>

      </div>
    </LegalLayout>
  )
}
