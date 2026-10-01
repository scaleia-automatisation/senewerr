import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShieldAlert, CheckCircle2, Clock, AlertTriangle, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Conformité CDPD — Super Admin' }

// Spec 27.5 — Conformité Sénégal (CDPD)
// Ce tableau de bord liste les formalités et vérifications requises avant mise en production.

type ComplianceItem = {
  id: string; label: string; detail: string
  status: 'done' | 'pending' | 'required'
  category: string
}

const COMPLIANCE_ITEMS: ComplianceItem[] = [
  // Formalités CDPD
  {
    id: 'cdpd_declaration', label: 'Déclaration à la CDPD',
    detail: 'Déclarer les traitements de données personnelles auprès de la Commission de protection des données personnelles du Sénégal.',
    status: 'required', category: 'cdpd',
  },
  {
    id: 'cdpd_formalites', label: 'Validation des formalités applicables',
    detail: 'Déterminer si le traitement relève d\'une déclaration simple, d\'une autorisation ou d\'un avis.',
    status: 'required', category: 'cdpd',
  },
  {
    id: 'conservation', label: 'Durées de conservation définies',
    detail: 'Établir et documenter les durées de conservation pour chaque catégorie de données (santé, identité, paiements, logs).',
    status: 'pending', category: 'cdpd',
  },
  {
    id: 'droits_patients', label: "Droits des patients documentés et applicables",
    detail: 'Droit d\'accès, de rectification, d\'opposition et de suppression — procédure opérationnelle en place.',
    status: 'pending', category: 'cdpd',
  },
  {
    id: 'hebergement', label: "Règles d'hébergement validées",
    detail: 'Localisation des serveurs Supabase et conformité avec les exigences locales de résidence des données de santé.',
    status: 'required', category: 'cdpd',
  },
  // Conformité ordonnances numériques
  {
    id: 'ordonnance_legale', label: 'Conformité des ordonnances numériques',
    detail: "Vérifier la valeur légale des ordonnances numériques au Sénégal avec l'Ordre des médecins et les autorités sanitaires.",
    status: 'required', category: 'ordonnances',
  },
  {
    id: 'partage_ordonnance', label: 'Modalités de partage entre acteurs',
    detail: 'Valider les règles de partage ordonnance → pharmacie → organisme avec les organismes concernés.',
    status: 'pending', category: 'ordonnances',
  },
  // Paiements et tiers payant
  {
    id: 'paiement_operateurs', label: 'Conformité paiements mobiles',
    detail: "Vérifier les agréments requis pour les paiements Orange Money / Wave au Sénégal (BCEAO / BCEAO-EME).",
    status: 'required', category: 'paiements',
  },
  {
    id: 'tiers_payant', label: 'Conformité du tiers payant',
    detail: "Valider les règles opérationnelles du tiers payant avec les organismes de couverture (mutuelles, IPM, assurances).",
    status: 'required', category: 'paiements',
  },
  // Sécurité (spec 27.2)
  {
    id: 'chiffrement', label: 'Chiffrement des données au repos',
    detail: 'Vérifier le chiffrement Supabase (AES-256) pour les données de santé au repos.',
    status: 'done', category: 'securite',
  },
  {
    id: 'rls_audit', label: 'Audit des politiques RLS',
    detail: 'Audit complet des Row Level Security policies — s\'assurer qu\'aucune donnée de santé n\'est accessible sans autorisation.',
    status: 'pending', category: 'securite',
  },
  {
    id: 'pentest', label: 'Test de pénétration (pentest)',
    detail: 'Réaliser un audit de sécurité externe avant la mise en production.',
    status: 'required', category: 'securite',
  },
  {
    id: 'incident_plan', label: 'Procédure de gestion des incidents',
    detail: 'Documenter la procédure de réponse en cas de violation de données (notification CDPD, patients concernés).',
    status: 'pending', category: 'securite',
  },
  {
    id: 'backup_plan', label: 'Plan de sauvegarde et de restauration',
    detail: 'Sauvegardes automatiques Supabase validées. Tester la restauration complète.',
    status: 'done', category: 'securite',
  },
  // Consentements
  {
    id: 'consentement_collecte', label: 'Consentement collecté à l\'inscription',
    detail: "Vérifier que le consentement est explicite pour chaque type de traitement dès l'inscription.",
    status: 'done', category: 'consentements',
  },
  {
    id: 'retrait_consentement', label: 'Retrait de consentement opérationnel',
    detail: 'Les patients peuvent retirer leurs consentements depuis /patient/confidentialite.',
    status: 'done', category: 'consentements',
  },
]

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  cdpd:         { label: 'CDPD & Formalités', color: 'text-purple-600' },
  ordonnances:  { label: 'Ordonnances numériques', color: 'text-[var(--sw-primary)]' },
  paiements:    { label: 'Paiements & Tiers payant', color: 'text-yellow-600' },
  securite:     { label: 'Sécurité (spec 27.2)', color: 'text-[var(--sw-danger)]' },
  consentements:{ label: 'Consentements (spec 27.3)', color: 'text-[var(--sw-success)]' },
}

export default async function ConformitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profils').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin') redirect('/connexion')

  const done = COMPLIANCE_ITEMS.filter(i => i.status === 'done').length
  const pending = COMPLIANCE_ITEMS.filter(i => i.status === 'pending').length
  const required = COMPLIANCE_ITEMS.filter(i => i.status === 'required').length
  const total = COMPLIANCE_ITEMS.length

  const categories = Object.keys(CATEGORY_LABELS)

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Conformité CDPD</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 27.5 — formalités avant mise en production (Sénégal)</p>
      </div>

      {/* Avertissement principal — spec 27.5 */}
      <div className="flex items-start gap-2 p-4 rounded-xl bg-[var(--sw-warning-bg)]">
        <ShieldAlert className="w-5 h-5 text-[var(--sw-warning)] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--sw-warning)]">Vérification requise avant mise en production</p>
          <p className="text-xs text-[var(--sw-warning)]">
            Séné Wérr doit faire vérifier ses traitements de données auprès des spécialistes compétents
            au regard des exigences de la Commission de protection des données personnelles du Sénégal
            (CDPD) avant toute mise en production (spec 27.5).
          </p>
        </div>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="sw-card p-3 text-center">
          <p className="text-2xl font-bold text-[var(--sw-success)]">{done}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Fait</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-2xl font-bold text-[var(--sw-warning)]">{pending}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">En cours</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-2xl font-bold text-[var(--sw-danger)]">{required}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Requis</p>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-[var(--sw-ink-3)]">
          <span>Progression</span>
          <span>{done}/{total}</span>
        </div>
        <div className="h-2 bg-[var(--sw-surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--sw-success)] rounded-full transition-all"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={total}
          />
        </div>
      </div>

      {/* Liste par catégorie */}
      {categories.map(cat => {
        const items = COMPLIANCE_ITEMS.filter(i => i.category === cat)
        if (!items.length) return null
        const catInfo = CATEGORY_LABELS[cat]
        return (
          <div key={cat}>
            <h2 className={`text-sm font-semibold mb-2 ${catInfo.color}`}>{catInfo.label}</h2>
            <div className="sw-card overflow-hidden">
              <div className="divide-y divide-[var(--sw-line)]">
                {items.map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {item.status === 'done' && (
                        <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" aria-label="Fait" />
                      )}
                      {item.status === 'pending' && (
                        <Clock className="w-4 h-4 text-[var(--sw-warning)]" aria-label="En cours" />
                      )}
                      {item.status === 'required' && (
                        <AlertTriangle className="w-4 h-4 text-[var(--sw-danger)]" aria-label="Requis" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--sw-ink)]">{item.label}</p>
                      <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">{item.detail}</p>
                    </div>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                      item.status === 'done'
                        ? 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]'
                        : item.status === 'pending'
                          ? 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]'
                          : 'bg-red-50 text-[var(--sw-danger)]'
                    }`}>
                      {item.status === 'done' ? 'Fait' : item.status === 'pending' ? 'En cours' : 'Requis'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Lien CDPD */}
      <div className="flex items-center gap-2 text-xs text-[var(--sw-ink-3)]">
        <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          Commission de protection des données personnelles du Sénégal :
          <span className="font-mono ml-1">cdp.sn</span>
        </span>
      </div>
    </div>
  )
}
