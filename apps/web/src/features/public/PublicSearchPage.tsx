import { Link } from 'react-router-dom'
import { Search, UserCheck, Building2 } from 'lucide-react'
import { Seo } from '@/hooks/useSeo'

export default function PublicSearchPage() {
  return (
    <>
      <Seo
        title="Rechercher un professionnel de santé au Sénégal — Medikool"
        description="Trouvez un médecin, une pharmacie ou un établissement de santé au Sénégal. Créez un compte gratuit pour accéder à la recherche complète et prendre rendez-vous."
        canonical="/recherche-publique"
      />

      <div className="mx-auto max-w-2xl px-s-4 py-s-12 text-center">
        <div className="mb-s-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
            <Search className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h1 className="mb-s-4 font-display text-h1 font-semibold text-ink">
          Rechercher un professionnel de santé
        </h1>
        <p className="mb-s-8 text-body leading-relaxed text-ink-2">
          Accédez à l'annuaire complet des médecins, pharmacies et établissements de santé
          vérifiés au Sénégal. Créez un compte gratuit pour rechercher, filtrer et prendre
          rendez-vous directement en ligne.
        </p>

        <div className="mb-s-8 grid gap-s-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface-2 p-s-5 text-left">
            <UserCheck className="mb-s-3 h-6 w-6 text-primary" />
            <h2 className="mb-s-1 font-semibold text-ink">Professionnels vérifiés</h2>
            <p className="text-small text-ink-3">
              Médecins, spécialistes et soignants dont les diplômes et licences ont été vérifiés.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-s-5 text-left">
            <Building2 className="mb-s-3 h-6 w-6 text-primary" />
            <h2 className="mb-s-1 font-semibold text-ink">Pharmacies et cliniques</h2>
            <p className="text-small text-ink-3">
              Trouvez une pharmacie avec le médicament qu'il vous faut, ou une clinique près de chez vous.
            </p>
          </div>
        </div>

        <Link
          to="/auth/inscription"
          className="inline-flex items-center gap-s-2 rounded-xl bg-primary px-s-6 py-s-3 font-medium text-white transition-opacity hover:opacity-90"
        >
          Créer un compte gratuit
        </Link>
        <p className="mt-s-3 text-small text-ink-3">
          Déjà un compte ?{' '}
          <Link to="/auth/connexion" className="text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </>
  )
}
