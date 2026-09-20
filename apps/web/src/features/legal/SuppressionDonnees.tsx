import { LegalLayout } from './LegalLayout'

export const META = {
  title: 'Suppression des données | Séne Wérr',
  description: 'Exercez votre droit à l\'effacement et demandez la suppression de vos données personnelles sur Séne Wérr.',
}

export default function SuppressionDonnees() {
  return (
    <LegalLayout title="Suppression de vos données" lastUpdated="17 septembre 2026">
      <div className="space-y-s-8 text-body text-ink-2 leading-relaxed">

        <section>
          <p>
            Conformément au RGPD et à la législation sénégalaise sur la protection des données
            personnelles, vous disposez d'un droit à l'effacement (« droit à l'oubli ») de vos
            données personnelles.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-h3 text-ink mb-s-3">Comment demander la suppression ?</h2>
          <p>
            Pour exercer votre droit à la suppression de vos données, vous pouvez :
          </p>
          <ul className="list-disc pl-s-6 mt-s-3 space-y-s-2">
            <li>Accéder à votre tableau de bord et utiliser la fonctionnalité « Supprimer mon compte »</li>
            <li>Contacter notre équipe à l'adresse <a href="mailto:privacy@senewerr.sn" className="text-primary hover:underline">privacy@senewerr.sn</a></li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-h3 text-ink mb-s-3">Délai de traitement</h2>
          <p>
            Votre demande sera traitée dans un délai maximum de 30 jours. Certaines données
            peuvent être conservées pour des obligations légales ou comptables.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-h3 text-ink mb-s-3">Données non supprimables</h2>
          <p>
            Conformément à la loi, certaines données doivent être conservées même après une
            demande de suppression : données de facturation (10 ans), ordonnances médicales
            (selon les règles de conservation des dossiers médicaux).
          </p>
        </section>

      </div>
    </LegalLayout>
  )
}
