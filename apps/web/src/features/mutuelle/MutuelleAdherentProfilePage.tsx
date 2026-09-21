import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  ArrowLeft, Download, Send, UserX, UserCheck,
  RefreshCw, Plus, Trash2, User, FileText, CreditCard,
  ClipboardList, FolderOpen, AlertCircle, CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { StatusBadge } from '@/components/mutuelle/StatusBadge'
import { ConfirmModal } from '@/components/mutuelle/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/mutuelle/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContratDetail {
  id: string
  numero_contrat: string
  statut: string
  type_couverture: string
  montant_cotisation: number
  date_debut: string
  date_fin: string
  nb_beneficiaires: number
  adherent_id: string
  adherent_nom: string
  adherent_avatar: string | null
  adherent_telephone: string | null
  adherent_email: string | null
  adherent_adresse: string | null
  adherent_naissance: string | null
  adherent_cni: string | null
  adherent_groupe_sanguin: string | null
  plan_nom: string
  plan_taux_consultation: number
  plan_taux_pharma: number
  plan_taux_hospit: number
  plan_plafond_annuel: number
  plan_taux_analyses: number
}

interface Beneficiaire {
  id: string
  nom: string
  lien: string
  date_naissance: string | null
}

interface Cotisation {
  id: string
  mois: string
  montant: number
  date_paiement: string
  moyen_paiement: string
  statut: string
}

interface Demande {
  id: string
  reference: string
  date: string
  prestataire: string
  montant_demande: number
  montant_approuve: number | null
  statut: string
  categorie: string
}

interface CarteData {
  numeroContrat: string
  adherentNom: string
  groupeSanguin: string | null
  statutContrat: string
  typeCouverture: string
  dateDebut: string
  dateFin: string
  planNom: string
  tauxConsultation: number
  tauxPharma: number
  tauxHostpit: number
  plafondAnnuel: number
  mutuelleNom: string
  mutuelleLogo: string | null
  mutuelleTelephone: string
  qrToken: string
}

type TabId = 'infos' | 'contrat' | 'cotisations' | 'demandes' | 'documents'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'infos',       label: 'Informations', icon: <User className="h-4 w-4" /> },
  { id: 'contrat',     label: 'Contrat',      icon: <FileText className="h-4 w-4" /> },
  { id: 'cotisations', label: 'Cotisations',  icon: <CreditCard className="h-4 w-4" /> },
  { id: 'demandes',    label: 'Demandes',     icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'documents',   label: 'Documents',    icon: <FolderOpen className="h-4 w-4" /> },
]

// ── Carte mutuelle (printable) ────────────────────────────────────────────────

function CarteMutuelleView({ carte, onClose }: { carte: CarteData; onClose: () => void }) {
  return (
    <div className="space-y-s-4">
      {/* Preview carte */}
      <div
        id="carte-mutuelle-print"
        className="mx-auto w-full max-w-sm rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/20 p-s-5 shadow-xl"
      >
        <div className="mb-s-3 flex items-center justify-between">
          <div>
            <p className="text-micro font-semibold uppercase tracking-widest text-primary">{carte.mutuelleNom}</p>
            <p className="text-micro text-ink-3">Carte de membre</p>
          </div>
          <StatusBadge status={carte.statutContrat.toLowerCase()} size="sm" />
        </div>
        <p className="mb-s-1 font-display text-h2 font-bold text-ink">{carte.adherentNom}</p>
        <p className="mb-s-3 font-mono text-small text-ink-2">{carte.numeroContrat}</p>
        <div className="mb-s-3 grid grid-cols-2 gap-s-2 rounded-xl bg-white/50 p-s-3 text-micro">
          <div><p className="text-ink-3">Plan</p><p className="font-semibold text-ink">{carte.planNom}</p></div>
          <div><p className="text-ink-3">Type</p><p className="font-semibold text-ink capitalize">{carte.typeCouverture}</p></div>
          <div><p className="text-ink-3">Début</p><p className="font-semibold text-ink">{format(new Date(carte.dateDebut), 'd MMM yyyy', { locale: fr })}</p></div>
          <div><p className="text-ink-3">Fin</p><p className="font-semibold text-ink">{format(new Date(carte.dateFin), 'd MMM yyyy', { locale: fr })}</p></div>
        </div>
        {/* QR code simulé (en prod: bibliothèque qrcode) */}
        <div className="flex items-center justify-between">
          <div className="rounded-lg bg-white p-s-1.5">
            <div className="grid grid-cols-5 gap-0.5">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className={`h-2.5 w-2.5 rounded-sm ${(i * 7 + i % 3) % 3 === 0 ? 'bg-ink' : 'bg-transparent'}`} />
              ))}
            </div>
          </div>
          <p className="text-micro text-ink-3 text-right">
            Tél. {carte.mutuelleTelephone}
            <br />{carte.groupeSanguin ? `Groupe : ${carte.groupeSanguin}` : ''}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-s-2">
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
        <Button variant="primary" leftIcon={<Download className="h-4 w-4" />} onClick={() => window.print()}>
          Imprimer / Télécharger
        </Button>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MutuelleAdherentProfilePage() {
  const { contratId } = useParams<{ contratId: string }>()
  const { mutuelle } = useMutuelle()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const db = supabase as any

  const [activeTab, setActiveTab] = useState<TabId>((searchParams.get('tab') as TabId) ?? 'infos')
  const [contrat, setContrat] = useState<ContratDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Sub-data
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([])
  const [cotisations, setCotisations] = useState<Cotisation[]>([])
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [carte, setCarte] = useState<CarteData | null>(null)

  // Modals
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [confirmReactivate, setConfirmReactivate] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [showCarte, setShowCarte] = useState(false)
  const [showAddBenef, setShowAddBenef] = useState(false)
  const [newBenef, setNewBenef] = useState({ nom: '', lien: 'enfant', date_naissance: '' })
  const [loadingReminder, setLoadingReminder] = useState(false)

  // Charger contrat
  const loadContrat = useCallback(async () => {
    if (!contratId || !mutuelle?.id) return
    setLoading(true)
    try {
      const { data } = await db
        .from('contrats')
        .select(`
          id, numero_contrat, statut, type_couverture, montant_cotisation,
          date_debut, date_fin, nb_beneficiaires, adherent_id,
          profiles!contrats_adherent_id_fkey(full_name, avatar_url, telephone, email, adresse, date_naissance, numero_identite, groupe_sanguin),
          plans_mutuelle!contrats_plan_id_fkey(nom, taux_consultation, taux_pharma, taux_hospit, plafond_annuel, taux_analyses)
        `)
        .eq('id', contratId)
        .eq('mutuelle_id', mutuelle.id)
        .single()

      if (!data) { navigate('/mutuelle/adherents'); return }

      const prof = data.profiles
      const plan = data.plans_mutuelle
      setContrat({
        id: data.id,
        numero_contrat: data.numero_contrat,
        statut: data.statut,
        type_couverture: data.type_couverture ?? 'individuel',
        montant_cotisation: data.montant_cotisation ?? 0,
        date_debut: data.date_debut,
        date_fin: data.date_fin,
        nb_beneficiaires: data.nb_beneficiaires ?? 1,
        adherent_id: data.adherent_id,
        adherent_nom: prof?.full_name ?? '',
        adherent_avatar: prof?.avatar_url ?? null,
        adherent_telephone: prof?.telephone ?? null,
        adherent_email: prof?.email ?? null,
        adherent_adresse: prof?.adresse ?? null,
        adherent_naissance: prof?.date_naissance ?? null,
        adherent_cni: prof?.numero_identite ?? null,
        adherent_groupe_sanguin: prof?.groupe_sanguin ?? null,
        plan_nom: plan?.nom ?? '',
        plan_taux_consultation: plan?.taux_consultation ?? 0,
        plan_taux_pharma: plan?.taux_pharma ?? 0,
        plan_taux_hospit: plan?.taux_hospit ?? 0,
        plan_plafond_annuel: plan?.plafond_annuel ?? 0,
        plan_taux_analyses: plan?.taux_analyses ?? 0,
      })
    } finally {
      setLoading(false)
    }
  }, [contratId, mutuelle?.id])

  useEffect(() => { loadContrat() }, [loadContrat])

  // Charger données selon onglet actif
  useEffect(() => {
    if (!contrat) return
    if (activeTab === 'infos') {
      db.from('contrat_beneficiaires')
        .select('id, nom, lien, date_naissance')
        .eq('contrat_id', contrat.id)
        .then(({ data }: any) => setBeneficiaires(data ?? []))
    }
    if (activeTab === 'cotisations') {
      db.from('cotisations')
        .select('id, mois, montant, date_paiement, moyen_paiement, statut')
        .eq('contrat_id', contrat.id)
        .order('mois', { ascending: false })
        .limit(36)
        .then(({ data }: any) => setCotisations(data ?? []))
    }
    if (activeTab === 'demandes') {
      db.from('remboursement_demandes')
        .select('id, reference, created_at, prestataire_nom, montant_demande, montant_approuve, statut, categorie')
        .eq('adherent_id', contrat.adherent_id)
        .eq('mutuelle_id', mutuelle!.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }: any) => setDemandes(
          (data ?? []).map((d: any) => ({
            id: d.id, reference: d.reference, date: d.created_at,
            prestataire: d.prestataire_nom ?? 'N/A',
            montant_demande: d.montant_demande ?? 0,
            montant_approuve: d.montant_approuve,
            statut: d.statut, categorie: d.categorie ?? 'autres',
          }))
        ))
    }
  }, [activeTab, contrat?.id])

  // Actions
  async function handleSuspend() {
    if (!contrat) return
    setLoadingAction(true)
    try {
      const { error } = await supabase.functions.invoke('suspend-adherent', {
        body: { contratId: contrat.id, action: 'suspendre' },
      })
      if (error) throw error
      toast.success('Adhérent suspendu')
      setConfirmSuspend(false)
      loadContrat()
    } catch { toast.error('Erreur lors de la suspension') }
    finally { setLoadingAction(false) }
  }

  async function handleReactivate() {
    if (!contrat) return
    setLoadingAction(true)
    try {
      const { error } = await supabase.functions.invoke('suspend-adherent', {
        body: { contratId: contrat.id, action: 'reactivate' },
      })
      if (error) throw error
      toast.success('Adhérent réactivé')
      setConfirmReactivate(false)
      loadContrat()
    } catch { toast.error('Erreur lors de la réactivation') }
    finally { setLoadingAction(false) }
  }

  async function handleGetCarte() {
    if (!contrat) return
    try {
      const { data, error } = await supabase.functions.invoke('get-carte-mutuelle', {
        body: { contratId: contrat.id },
      })
      if (error) throw error
      setCarte(data?.data ?? data)
      setShowCarte(true)
    } catch { toast.error('Impossible de générer la carte') }
  }

  async function handleRappelCotisation() {
    if (!contrat) return
    setLoadingReminder(true)
    try {
      const { error } = await supabase.functions.invoke('send-mutuelle-reminder', {
        body: { type: 'cotisation_rappel', contratIds: [contrat.id] },
      })
      if (error) throw error
      toast.success('Rappel envoyé')
    } catch { toast.error('Erreur envoi rappel') }
    finally { setLoadingReminder(false) }
  }

  async function handleAddBenef() {
    if (!newBenef.nom || !contrat) return
    try {
      await (db.from('contrat_beneficiaires').insert({
        contrat_id: contrat.id,
        nom: newBenef.nom,
        lien: newBenef.lien,
        date_naissance: newBenef.date_naissance || null,
      }))
      setBeneficiaires(b => [...b, {
        id: crypto.randomUUID(), nom: newBenef.nom,
        lien: newBenef.lien, date_naissance: newBenef.date_naissance || null,
      }])
      setNewBenef({ nom: '', lien: 'enfant', date_naissance: '' })
      setShowAddBenef(false)
      toast.success('Bénéficiaire ajouté')
    } catch { toast.error('Erreur') }
  }

  async function handleRemoveBenef(id: string) {
    await db.from('contrat_beneficiaires').delete().eq('id', id)
    setBeneficiaires(b => b.filter(x => x.id !== id))
    toast.success('Bénéficiaire retiré')
  }

  function changeTab(tab: TabId) {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // ── Onglet Informations ───
  function TabInfos() {
    if (!contrat) return null
    return (
      <div className="space-y-s-5">
        <section>
          <h3 className="mb-s-3 text-small font-semibold text-ink-3 uppercase tracking-wider">Données personnelles</h3>
          <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2">
            <InfoRow label="Nom complet" value={contrat.adherent_nom} />
            <InfoRow label="Téléphone" value={contrat.adherent_telephone ?? '—'} />
            <InfoRow label="Email" value={contrat.adherent_email ?? '—'} />
            <InfoRow label="Date de naissance" value={contrat.adherent_naissance ? format(new Date(contrat.adherent_naissance), 'd MMMM yyyy', { locale: fr }) : '—'} />
            <InfoRow label="Groupe sanguin" value={contrat.adherent_groupe_sanguin ?? '—'} />
            <InfoRow label="Adresse" value={contrat.adherent_adresse ?? '—'} />
          </div>
        </section>

        {contrat.type_couverture === 'famille' && (
          <section>
            <div className="mb-s-3 flex items-center justify-between">
              <h3 className="text-small font-semibold text-ink-3 uppercase tracking-wider">Bénéficiaires famille</h3>
              <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddBenef(true)}>
                Ajouter
              </Button>
            </div>
            {beneficiaires.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} message="Aucun bénéficiaire enregistré" />
            ) : (
              <div className="rounded-xl border border-line divide-y divide-line">
                {beneficiaires.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-s-4 py-s-3">
                    <div>
                      <p className="text-small font-medium text-ink">{b.nom}</p>
                      <p className="text-micro text-ink-3 capitalize">{b.lien}{b.date_naissance ? ` · ${format(new Date(b.date_naissance), 'd MMM yyyy', { locale: fr })}` : ''}</p>
                    </div>
                    <button onClick={() => handleRemoveBenef(b.id)} className="rounded p-s-1.5 text-ink-3 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    )
  }

  // ── Onglet Contrat ───
  function TabContrat() {
    if (!contrat) return null
    const today = new Date()
    const fin = new Date(contrat.date_fin)
    const isExpiring = fin <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return (
      <div className="space-y-s-5">
        <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2">
          <InfoRow label="N° Contrat" value={contrat.numero_contrat} mono />
          <InfoRow label="Plan" value={contrat.plan_nom} />
          <InfoRow label="Date de début" value={format(new Date(contrat.date_debut), 'd MMM yyyy', { locale: fr })} />
          <div>
            <InfoRow label="Date de fin" value={format(fin, 'd MMM yyyy', { locale: fr })} />
            {isExpiring && <p className="mt-s-1 text-micro text-amber-600">Expire dans {formatDistanceToNow(fin, { locale: fr })}</p>}
          </div>
          <InfoRow label="Cotisation mensuelle" value={formatFCFA(contrat.montant_cotisation)} />
          <InfoRow label="Type de couverture" value={contrat.type_couverture === 'famille' ? `Famille (${contrat.nb_beneficiaires} bénéficiaires)` : 'Individuel'} />
        </div>

        <section>
          <h3 className="mb-s-3 text-small font-semibold text-ink-3 uppercase tracking-wider">Taux de prise en charge</h3>
          <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-4">
            <TauxCard label="Consultations" taux={contrat.plan_taux_consultation} color="sky" />
            <TauxCard label="Médicaments" taux={contrat.plan_taux_pharma} color="emerald" />
            <TauxCard label="Hospitalisations" taux={contrat.plan_taux_hospit} color="violet" />
            <TauxCard label="Analyses" taux={contrat.plan_taux_analyses} color="amber" />
          </div>
          <div className="mt-s-3 rounded-xl border border-line bg-surface-2 px-s-4 py-s-3">
            <p className="text-small text-ink-3">Plafond annuel</p>
            <p className="font-display text-h3 font-bold text-ink">{formatFCFA(contrat.plan_plafond_annuel)}</p>
          </div>
        </section>
      </div>
    )
  }

  // ── Onglet Cotisations ───
  function TabCotisations() {
    const totalCotise = cotisations.reduce((s, c) => s + c.montant, 0)
    return (
      <div className="space-y-s-4">
        <div className="flex gap-s-3">
          <div className="flex-1 rounded-xl border border-line bg-surface-2 px-s-4 py-s-3">
            <p className="text-small text-ink-3">Total cotisé depuis l'adhésion</p>
            <p className="font-display text-h3 font-bold text-primary">{formatFCFA(totalCotise)}</p>
          </div>
        </div>
        {cotisations.length === 0 ? (
          <EmptyState icon={<CreditCard className="h-8 w-8" />} message="Aucune cotisation enregistrée" />
        ) : (
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full text-small">
              <thead className="bg-surface-2 border-b border-line">
                <tr>
                  {['Mois', 'Montant', 'Date paiement', 'Moyen', 'Statut'].map(h => (
                    <th key={h} className="px-s-4 py-s-2 text-left font-semibold text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {cotisations.map(c => (
                  <tr key={c.id} className="hover:bg-surface-2/50">
                    <td className="px-s-4 py-s-2 font-medium text-ink">{c.mois}</td>
                    <td className="px-s-4 py-s-2 text-ink">{formatFCFA(c.montant)}</td>
                    <td className="px-s-4 py-s-2 text-ink-3">{c.date_paiement ? format(new Date(c.date_paiement), 'd MMM yyyy', { locale: fr }) : '—'}</td>
                    <td className="px-s-4 py-s-2 text-ink-3 capitalize">{c.moyen_paiement ?? '—'}</td>
                    <td className="px-s-4 py-s-2">
                      <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${c.statut === 'paye' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.statut === 'paye' ? 'Payé' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Onglet Demandes ───
  function TabDemandes() {
    const totalDemande = demandes.reduce((s, d) => s + d.montant_demande, 0)
    const totalApprouve = demandes.reduce((s, d) => s + (d.montant_approuve ?? 0), 0)

    // Consommation mensuelle pour graphe
    const parMois: Record<string, number> = {}
    demandes.forEach(d => {
      const m = d.date.substring(0, 7)
      parMois[m] = (parMois[m] ?? 0) + (d.montant_approuve ?? 0)
    })
    const graphData = Object.entries(parMois)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mois, montant]) => ({ mois, montant }))

    return (
      <div className="space-y-s-4">
        <div className="grid grid-cols-2 gap-s-3">
          <div className="rounded-xl border border-line bg-surface-2 px-s-4 py-s-3">
            <p className="text-small text-ink-3">Total demandé</p>
            <p className="font-display text-h3 font-bold text-ink">{formatFCFA(totalDemande)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 px-s-4 py-s-3">
            <p className="text-small text-ink-3">Total approuvé</p>
            <p className="font-display text-h3 font-bold text-emerald-600">{formatFCFA(totalApprouve)}</p>
          </div>
        </div>

        {graphData.length > 0 && (
          <div className="rounded-xl border border-line bg-surface p-s-4">
            <p className="mb-s-3 text-small font-semibold text-ink">Consommation mensuelle</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={graphData}>
                <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000) + 'k'} />
                <Tooltip formatter={(v: any) => formatFCFA(Number(v))} labelFormatter={(l: any) => String(l)} />
                <Bar dataKey="montant" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {demandes.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-8 w-8" />} message="Aucune demande de remboursement" />
        ) : (
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full text-small">
              <thead className="bg-surface-2 border-b border-line">
                <tr>
                  {['Réf.', 'Date', 'Prestataire', 'Demandé', 'Approuvé', 'Statut'].map(h => (
                    <th key={h} className="px-s-4 py-s-2 text-left font-semibold text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {demandes.map(d => (
                  <tr key={d.id} className="hover:bg-surface-2/50">
                    <td className="px-s-4 py-s-2 font-mono text-micro text-ink-2">{d.reference}</td>
                    <td className="px-s-4 py-s-2 text-ink-3">{format(new Date(d.date), 'd MMM yyyy', { locale: fr })}</td>
                    <td className="px-s-4 py-s-2 text-ink">{d.prestataire}</td>
                    <td className="px-s-4 py-s-2 text-ink">{formatFCFA(d.montant_demande)}</td>
                    <td className="px-s-4 py-s-2">{d.montant_approuve != null ? <span className="text-emerald-600">{formatFCFA(d.montant_approuve)}</span> : <span className="text-ink-3">—</span>}</td>
                    <td className="px-s-4 py-s-2"><StatusBadge status={d.statut} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Onglet Documents ───
  function TabDocuments() {
    return (
      <div className="space-y-s-3">
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-s-4">
          <div>
            <p className="font-medium text-ink">Carte mutuelle</p>
            <p className="text-small text-ink-3">Carte de membre avec QR code d'éligibilité</p>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={handleGetCarte}>
            Télécharger
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-s-4">
          <div>
            <p className="font-medium text-ink">Attestation d'adhésion</p>
            <p className="text-small text-ink-3">Document officiel certifiant l'adhésion</p>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => toast.info('Fonctionnalité disponible prochainement')}>
            Télécharger
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-s-4">
          <div>
            <p className="font-medium text-ink">Certificat de prise en charge</p>
            <p className="text-small text-ink-3">Document pour les prestataires de soins</p>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => toast.info('Fonctionnalité disponible prochainement')}>
            Télécharger
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-s-6 space-y-s-4">
        <div className="h-8 w-48 rounded bg-surface-2 animate-pulse" />
        <div className="h-20 rounded-xl bg-surface-2 animate-pulse" />
        <div className="h-64 rounded-xl bg-surface-2 animate-pulse" />
      </div>
    )
  }

  if (!contrat) return null

  const isSuspendu = contrat.statut === 'SUSPENDU'
  const isActif = contrat.statut === 'ACTIF'

  return (
    <div className="space-y-s-4 p-s-4 md:p-s-6">
      {/* Back */}
      <button onClick={() => navigate('/mutuelle/adherents')} className="flex items-center gap-s-2 text-small text-ink-3 hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Retour aux adhérents
      </button>

      {/* En-tête profil */}
      <div className="flex flex-col gap-s-4 rounded-xl border border-line bg-surface p-s-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-s-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-h2 font-bold text-primary">
            {contrat.adherent_nom.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-h2 font-semibold text-ink">{contrat.adherent_nom}</h1>
            <p className="font-mono text-small text-ink-3">{contrat.numero_contrat}</p>
            <div className="mt-s-1 flex flex-wrap gap-s-2">
              <StatusBadge status={contrat.statut.toLowerCase()} />
              <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${contrat.type_couverture === 'famille' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                {contrat.type_couverture === 'famille' ? 'Famille' : 'Individuel'}
              </span>
              <span className="rounded-full bg-surface-2 px-s-2 py-s-0.5 text-micro font-semibold text-ink-2">
                {contrat.plan_nom}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-s-2">
          {!isSuspendu && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Send className="h-4 w-4" />}
              loading={loadingReminder}
              onClick={handleRappelCotisation}
            >
              Rappel cotisation
            </Button>
          )}
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={handleGetCarte}>
            Carte PDF
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => toast.info('Modal renouvellement — bientôt disponible')}>
            Renouveler
          </Button>
          {isActif && (
            <Button variant="danger" size="sm" leftIcon={<UserX className="h-4 w-4" />} onClick={() => setConfirmSuspend(true)}>
              Suspendre
            </Button>
          )}
          {isSuspendu && (
            <Button variant="primary" size="sm" leftIcon={<UserCheck className="h-4 w-4" />} onClick={() => setConfirmReactivate(true)}>
              Réactiver
            </Button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-s-1 overflow-x-auto border-b border-line pb-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => changeTab(t.id)}
            className={`flex shrink-0 items-center gap-s-2 px-s-4 py-s-2.5 text-small font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu onglet */}
      <div className="min-h-[300px]">
        {activeTab === 'infos'       && <TabInfos />}
        {activeTab === 'contrat'     && <TabContrat />}
        {activeTab === 'cotisations' && <TabCotisations />}
        {activeTab === 'demandes'    && <TabDemandes />}
        {activeTab === 'documents'   && <TabDocuments />}
      </div>

      {/* Modals */}
      <ConfirmModal
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title="Suspendre l'adhérent"
        message={`Vous êtes sur le point de suspendre ${contrat.adherent_nom}. L'accès au tiers payant sera immédiatement bloqué et l'adhérent sera notifié.`}
        confirmLabel="Suspendre"
        variant="danger"
        loading={loadingAction}
        onConfirm={handleSuspend}
      />
      <ConfirmModal
        open={confirmReactivate}
        onOpenChange={setConfirmReactivate}
        title="Réactiver l'adhérent"
        message={`Réactiver ${contrat.adherent_nom} ? L'adhérent pourra à nouveau utiliser le tiers payant.`}
        confirmLabel="Réactiver"
        variant="primary"
        loading={loadingAction}
        onConfirm={handleReactivate}
      />

      {/* Modal carte */}
      <Modal open={showCarte} onOpenChange={setShowCarte} title="Carte mutuelle" size="md">
        {carte && <CarteMutuelleView carte={carte} onClose={() => setShowCarte(false)} />}
      </Modal>

      {/* Modal ajouter bénéficiaire */}
      <Modal open={showAddBenef} onOpenChange={setShowAddBenef} title="Ajouter un bénéficiaire" size="sm">
        <div className="space-y-s-3">
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Nom complet *</label>
            <input
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              value={newBenef.nom} onChange={e => setNewBenef(b => ({ ...b, nom: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Lien de parenté</label>
            <select
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              value={newBenef.lien} onChange={e => setNewBenef(b => ({ ...b, lien: e.target.value }))}
            >
              <option value="conjoint">Conjoint(e)</option>
              <option value="enfant">Enfant</option>
              <option value="parent">Parent</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Date de naissance</label>
            <input type="date"
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              value={newBenef.date_naissance} onChange={e => setNewBenef(b => ({ ...b, date_naissance: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setShowAddBenef(false)}>Annuler</Button>
            <Button variant="primary" disabled={!newBenef.nom} onClick={handleAddBenef}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Sub-composants helpers ────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-s-3 py-s-2.5">
      <p className="text-micro text-ink-3">{label}</p>
      <p className={`text-small font-medium text-ink ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function TauxCard({ label, taux, color }: { label: string; taux: number; color: string }) {
  const colorMap: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700', emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className={`rounded-xl border border-line px-s-3 py-s-2.5 ${colorMap[color] ?? ''}`}>
      <p className="text-micro opacity-70">{label}</p>
      <p className="font-display text-h3 font-bold">{taux}%</p>
    </div>
  )
}

// import used in TabInfos
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
