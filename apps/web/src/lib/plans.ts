// Spec 23 — catalogue des offres par type d'acteur
// Tarifs commerciaux de départ, à valider auprès des partenaires sénégalais

export type PlanActorType = 'sante' | 'pharmacie' | 'etablissement' | 'couverture'

export type Plan = {
  key: string
  label: string
  price_fcfa: number | null   // null = sur devis
  price_label: string         // affichage
  commission_pct: number | null   // spec 23.2 — pharmacies uniquement
  features: string[]
  highlighted?: boolean       // plan recommandé
}

// Spec 23.1 — professionnels de santé indépendants
export const SANTE_PLANS: Plan[] = [
  {
    key: 'essentiel',
    label: 'Essentiel',
    price_fcfa: 10_000,
    price_label: '10 000 F CFA / mois',
    commission_pct: null,
    features: [
      'Profil professionnel',
      'Agenda',
      'Rendez-vous',
      'Rappels automatiques',
      'Ordonnances numériques',
      'Documents',
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    price_fcfa: 20_000,
    price_label: '20 000 F CFA / mois',
    commission_pct: null,
    highlighted: true,
    features: [
      'Toutes les fonctionnalités Essentiel',
      'Téléconsultation (si activée)',
      'Statistiques',
      'Automatisations administratives',
      "Assistance IA administrative",
      'Gestion avancée des patients',
    ],
  },
  {
    key: 'premium',
    label: 'Premium',
    price_fcfa: 35_000,
    price_label: '35 000 F CFA / mois',
    commission_pct: null,
    features: [
      'Toutes les fonctionnalités Pro',
      'Gestion multi-établissements avancée',
      'Assistants',
      'Statistiques avancées',
      'API et intégrations',
      'Accompagnement',
    ],
  },
]

// Spec 23.2 — pharmacies (commissions sur retraits effectifs, hors part organisme)
export const PHARMACIE_PLANS: Plan[] = [
  {
    key: 'decouverte',
    label: 'Découverte',
    price_fcfa: 0,
    price_label: 'Gratuit',
    commission_pct: 7,
    features: [
      'Profil pharmacie',
      'Catalogue médicaments',
      'Gestion des réservations',
      'Suivi des retraits',
    ],
  },
  {
    key: 'start',
    label: 'Start',
    price_fcfa: 5_000,
    price_label: '5 000 F CFA / mois',
    commission_pct: 5,
    features: [
      'Toutes les fonctionnalités Découverte',
      'Gestion de stock',
      'Tableau de bord',
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    price_fcfa: 15_000,
    price_label: '15 000 F CFA / mois',
    commission_pct: 3.5,
    highlighted: true,
    features: [
      'Toutes les fonctionnalités Start',
      'Statistiques avancées',
      'Suivi des prises en charge',
      'Gestion avancée des stocks',
    ],
  },
  {
    key: 'premium',
    label: 'Premium',
    price_fcfa: 30_000,
    price_label: '30 000 F CFA / mois',
    commission_pct: 2,
    features: [
      'Toutes les fonctionnalités Pro',
      'Intégrations',
      'Rapports avancés',
      'Support prioritaire',
    ],
  },
]

// Spec 23.3 — établissements de santé
export const ETABLISSEMENT_PLANS: Plan[] = [
  {
    key: 'cabinet',
    label: 'Cabinet',
    price_fcfa: 25_000,
    price_label: 'À partir de 25 000 F CFA / mois',
    commission_pct: null,
    features: [
      'Gestion des professionnels',
      'Agenda et rendez-vous',
      'Secrétariat',
      'Documents',
    ],
  },
  {
    key: 'clinique',
    label: 'Clinique',
    price_fcfa: 50_000,
    price_label: 'À partir de 50 000 F CFA / mois',
    commission_pct: null,
    highlighted: true,
    features: [
      'Gestion multi-professionnels',
      'Gestion des services',
      'Planning collectif',
      'Gestion des rendez-vous',
      "Rapports d'activité",
    ],
  },
  {
    key: 'hopital',
    label: 'Hôpital / Grande structure',
    price_fcfa: null,
    price_label: 'Sur devis',
    commission_pct: null,
    features: [
      'Gestion à grande échelle',
      'Plusieurs services',
      'Utilisateurs multiples',
      'Intégrations spécifiques',
      'Accompagnement au déploiement',
    ],
  },
]

// Spec 23.4 — mutuelles, IPM, assurances (offre B2B)
export const COUVERTURE_PLANS: Plan[] = [
  {
    key: 'b2b',
    label: 'Offre B2B',
    price_fcfa: 50_000,
    price_label: 'À partir de 50 000 F CFA / mois',
    commission_pct: null,
    features: [
      "Gestion des adhérents",
      'Gestion des formules et garanties',
      'Traitement des demandes de prise en charge',
      'Suivi des paiements',
      'Gestion des justificatifs',
      "Rapports d'activité",
      'Plusieurs utilisateurs',
    ],
  },
]

// Spec 23.5 — revenus complémentaires (add-ons)
export const ADDONS = [
  { key: 'teleconsultation', label: 'Téléconsultation', desc: 'Module vidéo intégré' },
  { key: 'sms_whatsapp', label: 'SMS & WhatsApp', desc: 'Notifications et rappels par SMS' },
  { key: 'api', label: 'API & Intégrations', desc: 'Accès programmatique à la plateforme' },
  { key: 'automations', label: 'Automatisations avancées', desc: 'Flux métiers sur mesure' },
  { key: 'rapports', label: 'Rapports avancés', desc: 'Exports et analyses approfondies' },
  { key: 'formation', label: 'Accompagnement & Formation', desc: 'Onboarding et support dédié' },
  { key: 'marque_blanche', label: 'Marque blanche', desc: 'Interface sous la marque du partenaire' },
]

export const PLANS_BY_ACTOR: Record<PlanActorType, Plan[]> = {
  sante: SANTE_PLANS,
  pharmacie: PHARMACIE_PLANS,
  etablissement: ETABLISSEMENT_PLANS,
  couverture: COUVERTURE_PLANS,
}

// Spec 23.6 — statuts d'abonnement
export type SubscriptionStatus = 'essai' | 'actif' | 'paiement_en_attente' | 'suspendu' | 'resilie' | 'expire'

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  essai: 'Essai', actif: 'Actif', paiement_en_attente: 'Paiement en attente',
  suspendu: 'Suspendu', resilie: 'Résilié', expire: 'Expiré',
}
export const SUBSCRIPTION_STATUS_CLASSES: Record<SubscriptionStatus, string> = {
  essai: 'bg-blue-50 text-blue-600',
  actif: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  paiement_en_attente: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  suspendu: 'bg-orange-50 text-orange-600',
  resilie: 'bg-red-50 text-[var(--sw-danger)]',
  expire: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}
