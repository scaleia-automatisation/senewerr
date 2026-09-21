import { useState, useEffect, useCallback, useMemo } from 'react'
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import {
  Search, Plus, Download, Eye, Pencil, Settings2, History,
  CheckCircle, AlertCircle, Users, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { MutuelleTable, type TableColumn } from '@/components/mutuelle/MutuelleTable'
import { StatusBadge } from '@/components/mutuelle/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import MutuelleAdherentProfilePage from './MutuelleAdherentProfilePage'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Adherent {
  contrat_id: string
  adherent_id: string
  nom: string
  avatar_url: string | null
  numero_contrat: string
  type_couverture: string
  statut: string
  montant_cotisation: number
  cotisation_ajour: boolean
  derniere_cotisation_at: string | null
  derniere_activite_at: string | null
}

interface PlanMutuelle {
  id: string
  nom: string
  montant_cotisation: number
}

type StatutFilter = '' | 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE' | 'EXPIRE'
type CotisationFilter = '' | 'ajour' | 'retard' | 'tres_retard'
type TypeFilter = '' | 'individuel' | 'famille'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

function exportCSV(rows: Adherent[]) {
  const headers = ['N° Contrat', 'Nom', 'Type', 'Statut', 'Cotisation/mois', 'À jour', 'Dernière activité']
  const lines = rows.map(r => [
    r.numero_contrat, r.nom, r.type_couverture, r.statut,
    r.montant_cotisation, r.cotisation_ajour ? 'Oui' : 'Non',
    r.derniere_activite_at ? format(new Date(r.derniere_activite_at), 'dd/MM/yyyy', { locale: fr }) : '',
  ].join(';'))
  const csv = [headers.join(';'), ...lines].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `adherents-${format(new Date(), 'yyyyMMdd')}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// ── Modal Nouvel adhérent ─────────────────────────────────────────────────────

function NouvelAdherentModal({ open, onOpenChange, mutuelleId, onCreated }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mutuelleId: string
  onCreated: (num: string) => void
}) {
  const db = supabase as any
  const [plans, setPlans] = useState<PlanMutuelle[]>([])
  const [form, setForm] = useState({
    prenom: '', nom: '', date_naissance: '', numero_identite: '',
    telephone: '+221', email: '', adresse: '', groupe_sanguin: '',
    type_couverture: 'individuel', nb_beneficiaires: '1',
    plan_id: '', date_debut: format(new Date(), 'yyyy-MM-dd'),
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !mutuelleId) return
    db.from('plans_mutuelle').select('id, nom, montant_cotisation')
      .eq('mutuelle_id', mutuelleId).then(({ data }: any) => setPlans(data ?? []))
  }, [open, mutuelleId])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.prenom || !form.nom || !form.telephone || !form.plan_id) {
      toast.error('Prénom, Nom, Téléphone et Plan sont obligatoires')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-adherent', {
        body: {
          prenom: form.prenom, nom: form.nom,
          date_naissance: form.date_naissance || null,
          numero_identite: form.numero_identite || null,
          telephone: form.telephone, email: form.email || null,
          adresse: form.adresse || null,
          groupe_sanguin: form.groupe_sanguin || null,
          type_couverture: form.type_couverture,
          nb_beneficiaires: parseInt(form.nb_beneficiaires),
          plan_id: form.plan_id, date_debut: form.date_debut,
        },
      })
      if (error) throw error
      const num: string = data?.data?.numeroContrat ?? data?.numeroContrat ?? ''
      toast.success(`Adhérent créé — N° contrat : ${num}`)
      onCreated(num)
      onOpenChange(false)
      setForm(f => ({ ...f, prenom: '', nom: '', telephone: '+221', email: '', numero_identite: '' }))
    } catch (err: any) {
      toast.error('Erreur : ' + (err?.message ?? 'inconnue'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Nouvel adhérent" size="xl">
      <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2">
        <Field label="Prénom *" value={form.prenom} onChange={v => set('prenom', v)} />
        <Field label="Nom *" value={form.nom} onChange={v => set('nom', v)} />
        <Field label="Date de naissance" value={form.date_naissance} onChange={v => set('date_naissance', v)} type="date" />
        <Field label="N° CNI / Passeport" value={form.numero_identite} onChange={v => set('numero_identite', v)} />
        <Field label="Téléphone *" value={form.telephone} onChange={v => set('telephone', v)} type="tel" />
        <Field label="Email" value={form.email} onChange={v => set('email', v)} type="email" />
        <div className="sm:col-span-2">
          <Field label="Adresse" value={form.adresse} onChange={v => set('adresse', v)} />
        </div>
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Groupe sanguin</label>
          <select className={selectCls} value={form.groupe_sanguin} onChange={e => set('groupe_sanguin', e.target.value)}>
            <option value="">— (optionnel)</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Type de couverture *</label>
          <select className={selectCls} value={form.type_couverture} onChange={e => set('type_couverture', e.target.value)}>
            <option value="individuel">Individuel</option>
            <option value="famille">Famille</option>
          </select>
        </div>
        {form.type_couverture === 'famille' && (
          <Field label="Nombre de bénéficiaires" value={form.nb_beneficiaires} onChange={v => set('nb_beneficiaires', v)} type="number" />
        )}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Plan de couverture *</label>
          <select className={selectCls} value={form.plan_id} onChange={e => set('plan_id', e.target.value)}>
            <option value="">Sélectionner un plan…</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.nom} — {formatFCFA(p.montant_cotisation)}/mois</option>)}
          </select>
        </div>
        <Field label="Date de début *" value={form.date_debut} onChange={v => set('date_debut', v)} type="date" />
      </div>
      <div className="mt-s-4 flex justify-end gap-s-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
        <Button
          variant="primary"
          loading={loading}
          disabled={!form.prenom || !form.nom || !form.telephone || !form.plan_id}
          onClick={submit}
        >
          Créer l'adhérent
        </Button>
      </div>
    </Modal>
  )
}

const selectCls = 'w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary'

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="mb-s-1 block text-small font-medium text-ink">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}

// ── Liste adhérents ───────────────────────────────────────────────────────────

function AdherentsList() {
  const { mutuelle } = useMutuelle()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const db = supabase as any

  const [adherents, setAdherents] = useState<Adherent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('')
  const [cotisationFilter, setCotisationFilter] = useState<CotisationFilter>('')
  const [showModal, setShowModal] = useState(false)

  // Ouvrir modal si action=new dans les query params
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowModal(true)
      setSearchParams({})
    }
  }, [searchParams])

  const load = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoading(true)
    try {
      const { data } = await db
        .from('contrats')
        .select(`
          id, numero_contrat, statut, type_couverture, montant_cotisation,
          derniere_cotisation_at, updated_at,
          adherent_id,
          profiles!contrats_adherent_id_fkey(full_name, avatar_url)
        `)
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
        .limit(500)

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const rows: Adherent[] = (data ?? []).map((c: any) => ({
        contrat_id: c.id,
        adherent_id: c.adherent_id,
        nom: c.profiles?.full_name ?? 'Adhérent',
        avatar_url: c.profiles?.avatar_url ?? null,
        numero_contrat: c.numero_contrat,
        type_couverture: c.type_couverture ?? 'individuel',
        statut: c.statut ?? 'EN_ATTENTE',
        montant_cotisation: c.montant_cotisation ?? 0,
        cotisation_ajour: c.derniere_cotisation_at
          ? new Date(c.derniere_cotisation_at) >= thirtyDaysAgo
          : false,
        derniere_cotisation_at: c.derniere_cotisation_at,
        derniere_activite_at: c.updated_at,
      }))
      setAdherents(rows)
    } finally {
      setLoading(false)
    }
  }, [mutuelle?.id])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return adherents.filter(a => {
      if (q && !a.nom.toLowerCase().includes(q) && !a.numero_contrat.toLowerCase().includes(q)) return false
      if (statutFilter && a.statut !== statutFilter) return false
      if (typeFilter && a.type_couverture !== typeFilter) return false
      if (cotisationFilter === 'ajour' && !a.cotisation_ajour) return false
      if (cotisationFilter === 'retard' && a.cotisation_ajour) return false
      if (cotisationFilter === 'tres_retard') {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        if (!a.derniere_cotisation_at || new Date(a.derniere_cotisation_at) >= sixtyDaysAgo) return false
      }
      return true
    })
  }, [adherents, search, statutFilter, typeFilter, cotisationFilter])

  const columns: TableColumn<Adherent>[] = [
    {
      key: 'nom',
      header: 'Adhérent',
      sortable: true,
      render: row => (
        <div className="flex items-center gap-s-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-small font-bold text-primary">
            {row.nom.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-ink">{row.nom}</span>
        </div>
      ),
    },
    {
      key: 'numero_contrat',
      header: 'N° Contrat',
      sortable: true,
      render: row => <span className="font-mono text-micro text-ink-2">{row.numero_contrat}</span>,
    },
    {
      key: 'type_couverture',
      header: 'Type',
      render: row => (
        <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${
          row.type_couverture === 'famille' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
        }`}>
          {row.type_couverture === 'famille' ? 'Famille' : 'Individuel'}
        </span>
      ),
    },
    {
      key: 'statut',
      header: 'Statut',
      sortable: true,
      render: row => <StatusBadge status={row.statut.toLowerCase()} size="sm" />,
    },
    {
      key: 'montant_cotisation',
      header: 'Cotisation',
      sortable: true,
      render: row => (
        <div className="flex items-center gap-s-1.5">
          <span className="text-ink">{formatFCFA(row.montant_cotisation)}</span>
          {row.cotisation_ajour
            ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
            : <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          }
        </div>
      ),
    },
    {
      key: 'derniere_activite_at',
      header: 'Dernière activité',
      sortable: true,
      render: row => row.derniere_activite_at
        ? <span className="text-ink-3">{formatDistanceToNow(new Date(row.derniere_activite_at), { locale: fr, addSuffix: true })}</span>
        : <span className="text-ink-3">—</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-0',
      render: row => (
        <div className="flex items-center gap-s-1" onClick={e => e.stopPropagation()}>
          <ActionBtn icon={<Eye className="h-3.5 w-3.5" />} title="Voir profil" onClick={() => navigate(`/mutuelle/adherents/${row.contrat_id}`)} />
          <ActionBtn icon={<Pencil className="h-3.5 w-3.5" />} title="Modifier" onClick={() => navigate(`/mutuelle/adherents/${row.contrat_id}?tab=infos`)} />
          <ActionBtn icon={<History className="h-3.5 w-3.5" />} title="Historique" onClick={() => navigate(`/mutuelle/adherents/${row.contrat_id}?tab=cotisations`)} />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-s-4 p-s-4 md:p-s-6">
      {/* Header */}
      <div className="flex flex-col gap-s-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">Adhérents</h1>
          <p className="text-small text-ink-3">{filtered.length} adhérent{filtered.length > 1 ? 's' : ''} visible{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-s-2">
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => exportCSV(filtered)}>
            Exporter CSV
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
            Nouvel adhérent
          </Button>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap gap-s-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="Nom, N° contrat, téléphone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-s-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select className={selectCls + ' w-auto'} value={statutFilter} onChange={e => setStatutFilter(e.target.value as StatutFilter)}>
          <option value="">Tous statuts</option>
          <option value="ACTIF">Actif</option>
          <option value="SUSPENDU">Suspendu</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="EXPIRE">Expiré</option>
        </select>
        <select className={selectCls + ' w-auto'} value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}>
          <option value="">Tous types</option>
          <option value="individuel">Individuel</option>
          <option value="famille">Famille</option>
        </select>
        <select className={selectCls + ' w-auto'} value={cotisationFilter} onChange={e => setCotisationFilter(e.target.value as CotisationFilter)}>
          <option value="">Cotisations (toutes)</option>
          <option value="ajour">À jour</option>
          <option value="retard">En retard</option>
          <option value="tres_retard">Très en retard (&gt; 60j)</option>
        </select>
      </div>

      <MutuelleTable
        columns={columns}
        data={filtered}
        loading={loading}
        pageSize={20}
        emptyMessage="Aucun adhérent correspondant aux critères"
        onRowClick={row => navigate(`/mutuelle/adherents/${row.contrat_id}`)}
      />

      {mutuelle && (
        <NouvelAdherentModal
          open={showModal}
          onOpenChange={setShowModal}
          mutuelleId={mutuelle.id}
          onCreated={() => load()}
        />
      )}
    </div>
  )
}

function ActionBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-s-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
    >
      {icon}
    </button>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function MutuelleAdhérentsPage() {
  return (
    <Routes>
      <Route index element={<AdherentsList />} />
      <Route path=":contratId/*" element={<MutuelleAdherentProfilePage />} />
    </Routes>
  )
}
