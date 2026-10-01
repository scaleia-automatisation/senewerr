'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, Building2, Users, Lock } from 'lucide-react'
import Link from 'next/link'
import { declarerCouverture } from '@/app/actions/couverture'

/* ─── Constantes ─────────────────────────────────────────────────────────── */

const TYPES = [
  {
    value: 'mutuelle_communautaire',
    label: 'Mutuelle communautaire',
    group: 'mutuelle',
    icon: Users,
    desc: 'Mutuelle de quartier, villageoise ou associative',
  },
  {
    value: 'mutuelle_professionnelle',
    label: 'Mutuelle professionnelle',
    group: 'mutuelle',
    icon: Building2,
    desc: 'Mutuelle liée à votre corps de métier',
  },
  {
    value: 'msae',
    label: 'MSAE',
    group: 'mutuelle',
    icon: Shield,
    desc: 'Mutuelle de Sécurité et d\'Assurance des Employés',
  },
  {
    value: 'ipm',
    label: 'IPM',
    group: 'ipm',
    icon: Building2,
    desc: 'Institution de Prévoyance Maladie (employeur)',
  },
  {
    value: 'assurance_privee',
    label: 'Assurance privée',
    group: 'assurance',
    icon: Lock,
    desc: 'Assurance santé souscrite à titre individuel ou collectif',
  },
] as const

type OrgType = typeof TYPES[number]['value']

/* ─── Composant ──────────────────────────────────────────────────────────── */

export default function DeclarerCouverturePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [orgType, setOrgType]         = useState<OrgType | ''>('')
  const [orgName, setOrgName]         = useState('')
  const [memberNumber, setMemberNumber] = useState('')
  const [employerName, setEmployerName] = useState('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [error, setError]             = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgType || !orgName.trim() || !startDate) return
    setError('')

    startTransition(async () => {
      const result = await declarerCouverture({
        orgType,
        orgName: orgName.trim(),
        memberNumber: memberNumber.trim() || null,
        employerName: employerName.trim() || null,
        startDate,
        endDate: endDate || null,
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/patient/couverture?declared=1')
      }
    })
  }

  const selectedType = TYPES.find(t => t.value === orgType)

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link
          href="/patient/couverture"
          className="p-1.5 rounded-lg hover:bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Déclarer ma couverture</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Renseignez vos informations de mutuelle, IPM ou assurance</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Étape 1 : type */}
        <div className="sw-card p-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--sw-ink)]">Type de couverture *</p>
          <div className="space-y-2">
            {TYPES.map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setOrgType(value); setOrgName('') }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  orgType === value
                    ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]'
                    : 'border-[var(--sw-line)] hover:border-[var(--sw-primary)]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  orgType === value ? 'bg-[var(--sw-primary)]' : 'bg-[var(--sw-surface-2)]'
                }`}>
                  <Icon className={`w-4 h-4 ${orgType === value ? 'text-white' : 'text-[var(--sw-ink-3)]'}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${orgType === value ? 'text-[var(--sw-primary)]' : 'text-[var(--sw-ink)]'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-[var(--sw-ink-3)]">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Étape 2 : infos organisme */}
        {orgType && (
          <div className="sw-card p-4 space-y-4">
            <p className="text-sm font-semibold text-[var(--sw-ink)]">
              Informations sur {selectedType?.label}
            </p>

            <div>
              <label className="block text-xs font-medium text-[var(--sw-ink-2)] mb-1">
                Nom de l'organisme *
              </label>
              <input
                className="sw-input w-full"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder={
                  orgType === 'ipm' ? 'Ex : IPM Sonatel, IPM BNS…' :
                  orgType === 'assurance_privee' ? 'Ex : Allianz, Sanlam, AXA…' :
                  'Ex : Mutuelle de santé de Thiès…'
                }
                required
              />
            </div>

            {orgType === 'ipm' && (
              <div>
                <label className="block text-xs font-medium text-[var(--sw-ink-2)] mb-1">
                  Employeur
                </label>
                <input
                  className="sw-input w-full"
                  value={employerName}
                  onChange={e => setEmployerName(e.target.value)}
                  placeholder="Nom de votre employeur"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--sw-ink-2)] mb-1">
                Numéro d'adhérent / matricule
              </label>
              <input
                className="sw-input w-full"
                value={memberNumber}
                onChange={e => setMemberNumber(e.target.value)}
                placeholder="Ex : MUT-2024-00123"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--sw-ink-2)] mb-1">
                  Date de début *
                </label>
                <input
                  type="date"
                  className="sw-input w-full"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--sw-ink-2)] mb-1">
                  Date de fin
                </label>
                <input
                  type="date"
                  className="sw-input w-full"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        {orgType && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--sw-info-bg)] text-xs text-[var(--sw-ink-2)]">
            <Shield className="w-4 h-4 text-[var(--sw-info)] flex-shrink-0 mt-0.5" />
            <span>
              Votre déclaration sera enregistrée et activée immédiatement.
              Si votre organisme n'est pas encore inscrit sur Séné Wérr, il sera ajouté en attente de vérification.
            </span>
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg)] px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!orgType || !orgName.trim() || !startDate || isPending}
          className="w-full py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-semibold
                     hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
        >
          {isPending ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Shield className="w-4 h-4" />
              Enregistrer ma couverture
            </>
          )}
        </button>
      </form>
    </div>
  )
}
