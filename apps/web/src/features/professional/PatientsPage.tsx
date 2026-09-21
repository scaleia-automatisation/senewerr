import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, UserCheck, Wallet, ChevronRight, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow, parseISO, differenceInYears, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Patient {
  id: string
  full_name: string
  date_naissance?: string | null
  sexe?: string | null
  avatar_url?: string | null
  telephone?: string | null
  derniere_consultation?: string | null
  nb_consultations: number
  allergies?: string[]
  pathologies_chroniques?: string[]
  mutuelle_nom?: string | null
  mutuelle_contrat?: string | null
}

// ── Nouveau Patient Modal ─────────────────────────────────────────────────────

const PATHOLOGIES_TAGS = ['Diabète', 'HTA', 'Asthme', 'Drépanocytose', 'Autre']
const GROUPES_SANGUINS = [
  { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' },
  { value: '',   label: 'Inconnu' },
]
const SEXE_OPTS = [
  { value: 'M', label: 'Masculin' },
  { value: 'F', label: 'Féminin' },
  { value: 'A', label: 'Autre / Non précisé' },
]

function NouveauPatientModal({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void
}) {
  const [prenom, setPrenom] = useState('')
  const [nom, setNom]       = useState('')
  const [dob, setDob]       = useState('')
  const [sexe, setSexe]     = useState('M')
  const [tel, setTel]       = useState('+221')
  const [email, setEmail]   = useState('')
  const [gs, setGs]         = useState('')
  const [allergieSaisie, setAllergieSaisie] = useState('')
  const [allergies, setAllergies]           = useState<string[]>([])
  const [pathos, setPathos]                 = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  function resetForm() {
    setPrenom(''); setNom(''); setDob(''); setSexe('M'); setTel('+221')
    setEmail(''); setGs(''); setAllergies([]); setPathos([]); setAllergieSaisie('')
  }

  function addAllergie() {
    const v = allergieSaisie.trim()
    if (v && !allergies.includes(v)) setAllergies(a => [...a, v])
    setAllergieSaisie('')
  }

  function togglePatho(p: string) {
    setPathos(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p])
  }

  async function submit() {
    if (!prenom.trim() || !nom.trim() || !dob || !tel.trim()) {
      toast.error('Prénom, nom, date de naissance et téléphone sont requis')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.functions.invoke('create-patient-praticien', {
      body: {
        prenom: prenom.trim(),
        nom: nom.trim(),
        date_naissance: dob,
        sexe,
        telephone: tel.trim(),
        email: email.trim() || undefined,
        groupe_sanguin: gs || undefined,
        allergies,
        pathologies_chroniques: pathos,
      }
    })
    setLoading(false)
    if (error) { toast.error('Erreur lors de la création'); return }
    toast.success(data?.is_new
      ? 'Patient créé — invitation SMS envoyée'
      : 'Patient existant ajouté à votre liste')
    resetForm()
    onOpenChange(false)
    onCreated(data?.patient_id)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Nouveau patient" size="lg">
      <div className="flex flex-col gap-s-4">
        {/* Identité */}
        <div className="grid grid-cols-2 gap-s-3">
          <Input label="Prénom *" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Prénom" />
          <Input label="Nom *" value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom de famille" />
        </div>
        <div className="grid grid-cols-2 gap-s-3">
          <Input label="Date de naissance *" type="date" value={dob} onChange={e => setDob(e.target.value)} />
          <Select label="Sexe *" options={SEXE_OPTS} value={sexe} onValueChange={setSexe} />
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-s-3">
          <Input label="Téléphone (+221) *" value={tel} onChange={e => setTel(e.target.value)} placeholder="+221 77 000 0000" />
          <Input label="Email (optionnel)" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@email.com" />
        </div>

        {/* Médical */}
        <Select label="Groupe sanguin" options={GROUPES_SANGUINS} value={gs} onValueChange={setGs} />

        {/* Allergies */}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Allergies connues</label>
          <div className="flex gap-s-2">
            <Input
              value={allergieSaisie}
              onChange={e => setAllergieSaisie(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAllergie())}
              placeholder="Pénicilline, arachides…"
              className="flex-1"
            />
            <Button variant="secondary" size="sm" onClick={addAllergie}>Ajouter</Button>
          </div>
          {allergies.length > 0 && (
            <div className="mt-s-2 flex flex-wrap gap-s-1">
              {allergies.map(a => (
                <span key={a} className="flex items-center gap-s-1 rounded-pill bg-red-100 px-s-2 py-0.5 text-micro font-medium text-red-700">
                  {a}
                  <button onClick={() => setAllergies(ar => ar.filter(x => x !== a))} className="hover:text-red-900">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pathologies */}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Pathologies chroniques</label>
          <div className="flex flex-wrap gap-s-2">
            {PATHOLOGIES_TAGS.map(p => (
              <button key={p} onClick={() => togglePatho(p)}
                className={cn(
                  'rounded-pill border px-s-3 py-s-1 text-small font-medium transition-colors',
                  pathos.includes(p)
                    ? 'border-primary bg-primary text-white'
                    : 'border-line bg-surface text-ink hover:border-primary',
                )}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-s-2 pt-s-2">
          <Button variant="ghost" onClick={() => { resetForm(); onOpenChange(false) }}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Créer le patient</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Patient Card ──────────────────────────────────────────────────────────────

function PatientCard({ patient, onClick }: { patient: Patient; onClick: () => void }) {
  const age = patient.date_naissance
    ? differenceInYears(new Date(), parseISO(patient.date_naissance))
    : null
  const hasAllergies = (patient.allergies?.length ?? 0) > 0
  const hasMutuelle  = !!patient.mutuelle_nom

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-s-3 rounded-lg border border-line bg-surface p-s-3 text-left transition-all hover:border-primary/40 hover:shadow-1"
    >
      <Avatar src={patient.avatar_url} fallback={patient.full_name} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-s-2">
          <span className="font-semibold text-ink truncate">{patient.full_name}</span>
          {hasAllergies && (
            <span title="Allergies connues">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
            </span>
          )}
        </div>
        <p className="text-small text-ink-3">
          {age !== null ? `${age} ans` : '—'}
          {patient.sexe ? ` · ${patient.sexe === 'M' ? 'Homme' : patient.sexe === 'F' ? 'Femme' : 'Autre'}` : ''}
        </p>
        {patient.pathologies_chroniques?.length ? (
          <p className="mt-0.5 text-micro text-ink-3 truncate">
            {patient.pathologies_chroniques.join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-s-1">
        {hasMutuelle && (
          <span className="flex items-center gap-s-1 text-micro text-emerald-600">
            <Wallet className="h-3 w-3" />{patient.mutuelle_nom}
          </span>
        )}
        {patient.derniere_consultation ? (
          <span className="text-micro text-ink-3">
            il y a {formatDistanceToNow(parseISO(patient.derniere_consultation), { locale: fr })}
          </span>
        ) : null}
        <span className="text-micro text-ink-3">{patient.nb_consultations} consult.</span>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

type ActivityFilter = 'tous' | 'actif' | 'inactif'
type MutuelleFilter = 'tous' | 'avec' | 'sans'
type SortField = 'derniere_consultation' | 'full_name' | 'nb_consultations'

export default function PatientsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const db = supabase as any

  const [patients, setPatients]   = useState<Patient[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(true)

  const [search, setSearch]               = useState('')
  const [activityFilter, setActivity]     = useState<ActivityFilter>('tous')
  const [mutuelleFilter, setMutuelle]     = useState<MutuelleFilter>('tous')
  const [pathoFilter, setPathoFilter]     = useState('')
  const [sortBy, setSortBy]               = useState<SortField>('derniere_consultation')

  const [showNouveauPatient, setShowNouveauPatient] = useState(false)

  const sixMonthsAgo = subMonths(new Date(), 6).toISOString()

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    let q = db
      .from('praticien_patients')
      .select(`
        patient:patient_id (
          id, full_name, date_naissance, sexe, avatar_url, telephone,
          dossier_medical:dossiers_medicaux (allergies, pathologies_chroniques, groupe_sanguin),
          mutuelle:assurances_patients!inner (nom_mutuelle, numero_contrat)
        ),
        derniere_consultation,
        nb_consultations
      `, { count: 'exact' })
      .eq('praticien_id', profile.id)
      .eq('actif', true)

    if (activityFilter === 'actif')   q = q.gte('derniere_consultation', sixMonthsAgo)
    if (activityFilter === 'inactif') q = q.lt('derniere_consultation', sixMonthsAgo)

    if (sortBy === 'derniere_consultation') q = q.order('derniere_consultation', { ascending: false, nullsFirst: false })
    if (sortBy === 'nb_consultations')      q = q.order('nb_consultations', { ascending: false })

    const from = page * PAGE_SIZE
    q = q.range(from, from + PAGE_SIZE - 1)

    const { data, count, error } = await q

    if (error) { setLoading(false); return }

    let flat: Patient[] = (data ?? []).map((row: any) => {
      const p = row.patient
      const dm = Array.isArray(p?.dossier_medical)
        ? p.dossier_medical[0]
        : p?.dossier_medical
      const mut = Array.isArray(p?.mutuelle)
        ? p.mutuelle[0]
        : p?.mutuelle
      return {
        id: p?.id,
        full_name: p?.full_name ?? '',
        date_naissance: p?.date_naissance,
        sexe: p?.sexe,
        avatar_url: p?.avatar_url,
        telephone: p?.telephone,
        derniere_consultation: row.derniere_consultation,
        nb_consultations: row.nb_consultations ?? 0,
        allergies: dm?.allergies ?? [],
        pathologies_chroniques: dm?.pathologies_chroniques ?? [],
        mutuelle_nom: mut?.nom_mutuelle ?? null,
        mutuelle_contrat: mut?.numero_contrat ?? null,
      } as Patient
    })

    // Client-side filters (search, mutuelle, patho)
    if (search.trim()) {
      const s = search.toLowerCase()
      flat = flat.filter(p =>
        p.full_name.toLowerCase().includes(s) ||
        (p.telephone ?? '').includes(s)
      )
    }
    if (mutuelleFilter === 'avec') flat = flat.filter(p => !!p.mutuelle_nom)
    if (mutuelleFilter === 'sans') flat = flat.filter(p => !p.mutuelle_nom)
    if (pathoFilter) flat = flat.filter(p => p.pathologies_chroniques?.includes(pathoFilter))
    if (sortBy === 'full_name') flat.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'))

    setPatients(flat)
    setTotal(count ?? 0)
    setLoading(false)
  }, [profile?.id, page, activityFilter, mutuelleFilter, pathoFilter, sortBy, search, sixMonthsAgo])

  useEffect(() => { load() }, [load])

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [search, activityFilter, mutuelleFilter, pathoFilter, sortBy])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const ACTIVITY_OPTS = [
    { value: 'tous',    label: 'Tous' },
    { value: 'actif',   label: 'Actifs (< 6 mois)' },
    { value: 'inactif', label: 'Inactifs' },
  ]
  const MUTUELLE_OPTS = [
    { value: 'tous', label: 'Avec ou sans mutuelle' },
    { value: 'avec', label: 'Avec mutuelle' },
    { value: 'sans', label: 'Sans mutuelle' },
  ]
  const SORT_OPTS = [
    { value: 'derniere_consultation', label: 'Dernier RDV' },
    { value: 'full_name',            label: 'Nom A→Z' },
    { value: 'nb_consultations',     label: 'Nb consultations' },
  ]
  const PATHO_OPTS = [
    { value: '', label: 'Toutes pathologies' },
    ...PATHOLOGIES_TAGS.map(p => ({ value: p, label: p })),
  ]

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-s-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone…"
            className="w-full rounded-lg border border-line bg-surface py-s-2 pl-9 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
          />
        </div>
        <Select options={ACTIVITY_OPTS} value={activityFilter} onValueChange={v => setActivity(v as ActivityFilter)} />
        <Select options={MUTUELLE_OPTS} value={mutuelleFilter} onValueChange={v => setMutuelle(v as MutuelleFilter)} />
        <Select options={PATHO_OPTS}   value={pathoFilter}    onValueChange={setPathoFilter} />
        <Select options={SORT_OPTS}    value={sortBy}         onValueChange={v => setSortBy(v as SortField)} />
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowNouveauPatient(true)}>
          Nouveau patient
        </Button>
      </div>

      {/* Stats */}
      <p className="text-small text-ink-3">
        {loading ? '…' : `${total} patient${total !== 1 ? 's' : ''}`}
        {patients.filter(p => (p.allergies?.length ?? 0) > 0).length > 0 && (
          <span className="ml-s-2 text-red-500">
            · {patients.filter(p => (p.allergies?.length ?? 0) > 0).length} avec allergies
          </span>
        )}
      </p>

      {/* List */}
      <div className="flex flex-col gap-s-2">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
          : patients.length === 0
            ? (
              <Card className="py-s-12 text-center">
                <UserCheck className="mx-auto mb-s-2 h-10 w-10 text-ink-3" />
                <p className="font-medium text-ink">Aucun patient trouvé</p>
                <p className="text-small text-ink-3">Modifiez vos filtres ou ajoutez un nouveau patient.</p>
              </Card>
            )
            : patients.map(p => (
              <PatientCard key={p.id} patient={p} onClick={() => navigate(`/pro/patients/${p.id}`)} />
            ))
        }
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-s-2">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Précédent
          </Button>
          <span className="text-small text-ink-3">Page {page + 1} / {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Suivant
          </Button>
        </div>
      )}

      <NouveauPatientModal
        open={showNouveauPatient}
        onOpenChange={setShowNouveauPatient}
        onCreated={(id) => { load(); navigate(`/pro/patients/${id}`) }}
      />
    </div>
  )
}
