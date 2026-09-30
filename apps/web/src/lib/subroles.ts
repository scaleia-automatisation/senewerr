export type ActorSubRole =
  | PatientSubRole
  | SanteSubRole
  | PharmacieSubRole
  | CouvertureSubRole
  | AdminSubRole

export type PatientSubRole     = 'patient_principal' | 'beneficiaire' | 'representant_legal'
export type SanteSubRole       = 'professionnel_independant' | 'medecin' | 'secretaire' | 'responsable_etablissement'
export type PharmacieSubRole   = 'pharmacien_titulaire' | 'pharmacien' | 'preparateur' | 'gestionnaire'
export type CouvertureSubRole  = 'gestionnaire' | 'agent_prise_en_charge' | 'responsable_financier'
export type AdminSubRole       = 'admin' | 'super_admin'

export const SANTE_SUBROLES: { value: SanteSubRole; label: string; desc: string }[] = [
  { value: 'professionnel_independant', label: 'Professionnel indépendant', desc: 'Exerce en dehors de tout établissement' },
  { value: 'medecin',                   label: 'Médecin / Praticien',        desc: 'Réalise des consultations et prescriptions' },
  { value: 'secretaire',                label: 'Secrétaire médical(e)',       desc: 'Gère les rendez-vous, pas les données médicales' },
  { value: 'responsable_etablissement', label: 'Responsable d\'établissement', desc: 'Gère l\'établissement et son équipe' },
]

export const PHARMACIE_SUBROLES: { value: PharmacieSubRole; label: string; desc: string }[] = [
  { value: 'pharmacien_titulaire', label: 'Pharmacien titulaire',    desc: 'Responsable légal de la pharmacie' },
  { value: 'pharmacien',          label: 'Pharmacien',              desc: 'Valide les ordonnances et dispense les médicaments' },
  { value: 'preparateur',         label: 'Préparateur en pharmacie', desc: 'Prépare et délivre les médicaments sur ordonnance' },
  { value: 'gestionnaire',        label: 'Gestionnaire',            desc: 'Gère les stocks et les statistiques' },
]

export const COUVERTURE_SUBROLES: { value: CouvertureSubRole; label: string; desc: string }[] = [
  { value: 'gestionnaire',           label: 'Gestionnaire',               desc: 'Administre l\'organisme et son équipe' },
  { value: 'agent_prise_en_charge',  label: 'Agent de prise en charge',   desc: 'Traite les dossiers de remboursement' },
  { value: 'responsable_financier',  label: 'Responsable financier',      desc: 'Supervise les engagements et les paiements' },
]

export const PERMISSIONS: Record<string, { allowed: string[]; restricted: string[] }> = {
  secretaire: {
    allowed: [
      'Créer et modifier des rendez-vous',
      'Voir la liste des patients',
      'Gérer l\'agenda de l\'établissement',
      'Envoyer des notifications de rappel',
    ],
    restricted: [
      'Accéder aux comptes rendus médicaux',
      'Rédiger des ordonnances',
      'Consulter les données de santé détaillées',
    ],
  },
  agent_prise_en_charge: {
    allowed: [
      'Traiter les dossiers de remboursement',
      'Vérifier les droits des adhérents',
      'Approuver ou refuser les prises en charge',
      'Envoyer des notifications aux bénéficiaires',
    ],
    restricted: [
      'Accéder à l\'intégralité du carnet de santé',
      'Modifier les contrats ou les taux',
      'Gérer l\'équipe ou les comptes',
    ],
  },
  preparateur: {
    allowed: [
      'Préparer et délivrer les médicaments',
      'Gérer le stock de la pharmacie',
      'Traiter les réservations en cours',
    ],
    restricted: [
      'Valider des ordonnances de manière autonome',
      'Modifier le catalogue ou les tarifs',
      'Accéder aux statistiques financières',
    ],
  },
}
