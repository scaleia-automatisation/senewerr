import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EstablishmentType =
  | 'cabinet' | 'clinique' | 'hopital' | 'centre_medical'
  | 'laboratoire' | 'centre_imagerie'

export interface EstablishmentTheme {
  color: string
  bgClass: string
  borderClass: string
  textClass: string
  label: string
}

const TYPE_THEME: Record<EstablishmentType, EstablishmentTheme> = {
  cabinet:         { color: '#1A7A4C', bgClass: 'bg-primary/10',    borderClass: 'border-primary',    textClass: 'text-primary',    label: 'Cabinet' },
  clinique:        { color: '#0EA5E9', bgClass: 'bg-sky-500/10',    borderClass: 'border-sky-500',    textClass: 'text-sky-600',    label: 'Clinique' },
  hopital:         { color: '#EF4444', bgClass: 'bg-red-500/10',    borderClass: 'border-red-500',    textClass: 'text-red-600',    label: 'Hôpital' },
  centre_medical:  { color: '#8B5CF6', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500', textClass: 'text-violet-600', label: 'Centre médical' },
  laboratoire:     { color: '#22C55E', bgClass: 'bg-green-500/10',  borderClass: 'border-green-500',  textClass: 'text-green-600',  label: 'Laboratoire' },
  centre_imagerie: { color: '#F59E0B', bgClass: 'bg-amber-500/10',  borderClass: 'border-amber-500',  textClass: 'text-amber-600',  label: "Centre d'imagerie" },
}

export interface OrgOption {
  orgId: string
  orgName: string
  establishmentId: string
  establishmentType: EstablishmentType
}

interface EtabHealthCtx {
  orgId: string | null
  establishmentId: string | null
  establishmentType: EstablishmentType | null
  establishmentName: string
  theme: EstablishmentTheme
  organizations: OrgOption[]
  setActiveOrg: (orgId: string) => void
  loading: boolean
}

// ── Context ───────────────────────────────────────────────────────────────────

const defaultTheme: EstablishmentTheme = TYPE_THEME.clinique

const Ctx = createContext<EtabHealthCtx>({
  orgId: null,
  establishmentId: null,
  establishmentType: null,
  establishmentName: 'Établissement',
  theme: defaultTheme,
  organizations: [],
  setActiveOrg: () => {},
  loading: true,
})

export function useEtabHealth() {
  return useContext(Ctx)
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function EtabHealthProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [organizations, setOrganizations] = useState<OrgOption[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return

    async function load() {
      // 1. Toutes les orgs de type establishment où l'utilisateur est membre actif
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(id, name, type)')
        .eq('profile_id', profile!.id)
        .eq('status', 'active')

      const estabOrgs = (memberships ?? [])
        .map((m: any) => m.organizations)
        .filter((o: any) => o?.type === 'establishment')

      if (!estabOrgs.length) { setLoading(false); return }

      // 2. Pour chaque org, récupérer l'établissement lié
      const estabIds = estabOrgs.map((o: any) => o.id)
      const { data: estabs } = await (supabase as any)
        .from('establishments')
        .select('id, organization_id, establishment_type')
        .in('organization_id', estabIds)

      if (!estabs?.length) { setLoading(false); return }

      // 3. Construire la liste des options multi-site
      const options: OrgOption[] = estabOrgs
        .map((org: any) => {
          const estab = (estabs as any[]).find((e: any) => e.organization_id === org.id)
          if (!estab) return null
          return {
            orgId: org.id,
            orgName: org.name ?? 'Établissement',
            establishmentId: estab.id,
            establishmentType: estab.establishment_type as EstablishmentType,
          } satisfies OrgOption
        })
        .filter(Boolean) as OrgOption[]

      setOrganizations(options)
      setActiveOrgId(prev => prev ?? options[0]?.orgId ?? null)
      setLoading(false)
    }

    load()
  }, [profile])

  const active = organizations.find(o => o.orgId === activeOrgId) ?? null

  const value: EtabHealthCtx = {
    orgId: active?.orgId ?? null,
    establishmentId: active?.establishmentId ?? null,
    establishmentType: active?.establishmentType ?? null,
    establishmentName: active?.orgName ?? 'Établissement',
    theme: active ? (TYPE_THEME[active.establishmentType] ?? defaultTheme) : defaultTheme,
    organizations,
    setActiveOrg: (id) => setActiveOrgId(id),
    loading,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
