import { useState, useEffect, useCallback } from 'react'
import { differenceInYears, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Plus, Trash2, Settings2, Eye, Mail, User, Users, Baby,
  ChevronRight, AlertTriangle, CheckCircle, Clock, X,
  HeartPulse, Calendar, FileText, Syringe, ShieldOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Droits {
  voir_dossier: boolean
  prendre_rdv: boolean
  gerer_paiements: boolean
}

interface MembreFamille {
  id: string
  gestionnaire_id: string
  membre_user_id: string | null
  prenom: string
  nom: string
  date_naissance: string
  lien: 'conjoint' | 'enfant' | 'parent' | 'autre'
  est_mineur: boolean
  statut: 'actif' | 'invitation_envoyee' | 'sans_compte'
  droits: Droits
}

interface DossierMembre {
  groupe_sanguin?: string
  allergies?: string[]
  antecedents?: string[]
  prochain_rdv?: { date: string; praticien_nom: string; type: string }
  ordonnances_actives?: { nom_medicament: string; posologie: string }[]
  documents?: { nom: string; categorie: string; created_at: string }[]
  vaccination_a_jour?: boolean
}

interface AyantDroit {
  prenom: string
  nom: string
  lien: string
  consommation_annuelle: number
  plafond_annuel: number
}

const LIEN_LABELS: Record<string, string> = {
  conjoint: 'Conjoint·e',
  enfant:   'Enfant',
  parent:   'Parent',
  autre:    'Autre',
}

const STATUT_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  actif:               { label: 'Compte actif',            cls: 'bg-status-success/10 text-status-success', dot: 'bg-status-success' },
  invitation_envoyee:  { label: 'Invitation en attente',   cls: 'bg-status-pending/10 text-status-pending', dot: 'bg-status-pending' },
  sans_compte:         { label: 'Profil mineur géré',      cls: 'bg-primary-soft text-primary',             dot: 'bg-primary' },
}

function initials(prenom: string, nom: string) {
  return `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()
}

function age(dateNaissance: string): number {
  return differenceInYears(new Date(), new Date(dateNaissance))
}

// ─── RightsModal ──────────────────────────────────────────────────────────────
function RightsModal({ membre, open, onClose, onSaved }: {
  membre: MembreFamille | null
  open: boolean
  onClose: () => void
  onSaved: (id: string, droits: Droits) => void
}) {
  const db = supabase as any
  const [droits, setDroits] = useState<Droits>({ voir_dossier: false, prendre_rdv: false, gerer_paiements: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (membre) setDroits({ ...membre.droits }) }, [membre])

  async function save() {
    if (!membre) return
    setSaving(true)
    await db.from('membres_famille').update({ droits }).eq('id', membre.id)
    onSaved(membre.id, droits)
    setSaving(false)
    toast.success('Droits mis à jour.')
    onClose()
  }

  const TOGGLES: { key: keyof Droits; label: string; desc: string }[] = [
    { key: 'voir_dossier',    label: 'Voir le dossier médical',   desc: 'Accès aux consultations, ordonnances et résultats.' },
    { key: 'prendre_rdv',     label: 'Prendre des RDV en son nom', desc: 'Vous pouvez réserver des rendez-vous pour ce membre.' },
    { key: 'gerer_paiements', label: 'Gérer les paiements',        desc: 'Accès aux factures et paiements de ce membre.' },
  ]

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={`Droits de ${membre?.prenom ?? ''}`} size="sm">
      <div className="flex flex-col gap-s-4">
        {TOGGLES.map(t => (
          <Switch
            key={t.key}
            checked={droits[t.key]}
            onCheckedChange={v => setDroits(prev => ({ ...prev, [t.key]: v }))}
            label={t.label}
            description={t.desc}
          />
        ))}
        <div className="flex gap-s-2 pt-s-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button className="flex-1" onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── DossierDrawer ────────────────────────────────────────────────────────────
function DossierDrawer({ membre, open, onClose }: {
  membre: MembreFamille | null; open: boolean; onClose: () => void
}) {
  const [dossier, setDossier] = useState<DossierMembre | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!open || !membre) return
    setLoading(true); setDossier(null); setError(null)
    supabase.functions.invoke('get-famille-dossier', {
      body: { membreId: membre.id },
    }).then(({ data, error: fnErr }) => {
      if (fnErr || data?.error) {
        setError('Accès refusé ou données indisponibles.')
      } else {
        setDossier(data as DossierMembre)
      }
      setLoading(false)
    })
  }, [open, membre?.id])

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={`Dossier de ${membre?.prenom ?? ''}`} size="lg">
      <div className="flex flex-col gap-s-5">
        {loading && <div className="flex flex-col gap-s-3">{[1,2,3].map(i=><Skeleton key={i} className="h-16 rounded-md"/>)}</div>}

        {error && (
          <div className="flex items-center gap-s-2 rounded-md bg-status-danger/10 px-s-4 py-s-3 text-small text-status-danger">
            <ShieldOff className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && dossier && (
          <>
            {/* Résumé santé */}
            <div className="rounded-md border border-line bg-surface p-s-4">
              <div className="flex items-center gap-s-2 mb-s-3">
                <HeartPulse className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-ink">Résumé santé</h3>
              </div>
              <div className="grid grid-cols-3 gap-s-3">
                <div className="text-center rounded-md bg-surface-2 px-s-2 py-s-2">
                  <p className="text-micro text-ink-3">Groupe sanguin</p>
                  <p className="font-bold text-ink text-small">{dossier.groupe_sanguin ?? 'NC'}</p>
                </div>
                <div className="col-span-2 rounded-md bg-surface-2 px-s-3 py-s-2">
                  <p className="text-micro text-ink-3 mb-s-1">Allergies</p>
                  {dossier.allergies?.length ? (
                    <div className="flex flex-wrap gap-s-1">
                      {dossier.allergies.map(a => (
                        <span key={a} className="rounded-pill bg-status-danger/10 px-s-2 py-0.5 text-micro text-status-danger">{a}</span>
                      ))}
                    </div>
                  ) : <p className="text-small text-ink-3">Aucune connue</p>}
                </div>
              </div>
              {dossier.antecedents?.length ? (
                <div className="mt-s-3">
                  <p className="text-micro text-ink-3 mb-s-1">Antécédents</p>
                  <div className="flex flex-wrap gap-s-1">
                    {dossier.antecedents.map(a => (
                      <span key={a} className="rounded-pill bg-surface-2 border border-line px-s-2 py-0.5 text-micro text-ink-2">{a}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Prochain RDV */}
            {dossier.prochain_rdv && (
              <div className="rounded-md border border-line bg-surface p-s-4">
                <div className="flex items-center gap-s-2 mb-s-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-ink">Prochain rendez-vous</h3>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-small font-medium text-ink">{dossier.prochain_rdv.praticien_nom}</p>
                    <p className="text-micro text-ink-2">{dossier.prochain_rdv.type}</p>
                  </div>
                  <p className="text-small font-medium text-primary whitespace-nowrap">
                    {format(new Date(dossier.prochain_rdv.date), 'd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>
            )}

            {/* Ordonnances actives */}
            {dossier.ordonnances_actives?.length ? (
              <div className="rounded-md border border-line bg-surface p-s-4">
                <div className="flex items-center gap-s-2 mb-s-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-ink">Ordonnances actives ({dossier.ordonnances_actives.length})</h3>
                </div>
                <div className="flex flex-col gap-s-2">
                  {dossier.ordonnances_actives.map((o, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-surface-2 px-s-3 py-s-2">
                      <p className="text-small font-medium text-ink">{o.nom_medicament}</p>
                      <p className="text-micro text-ink-2">{o.posologie}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Documents */}
            {dossier.documents?.length ? (
              <div className="rounded-md border border-line bg-surface p-s-4">
                <div className="flex items-center gap-s-2 mb-s-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-ink">Documents récents</h3>
                </div>
                <div className="flex flex-col gap-s-1">
                  {dossier.documents.slice(0, 5).map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-small py-s-1 border-b border-line last:border-0">
                      <span className="text-ink truncate">{d.nom}</span>
                      <span className="text-micro text-ink-3 whitespace-nowrap ml-s-2">
                        {format(new Date(d.created_at), 'd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Vaccination */}
            <div className="rounded-md border border-line bg-surface p-s-4">
              <div className="flex items-center gap-s-2 mb-s-2">
                <Syringe className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-ink">Vaccination</h3>
              </div>
              <div className="flex items-center gap-s-2">
                {dossier.vaccination_a_jour ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-status-success" />
                    <span className="text-small font-medium text-status-success">À jour</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-status-pending" />
                    <span className="text-small font-medium text-status-pending">Mise à jour recommandée</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── AddMemberDrawer ──────────────────────────────────────────────────────────
function AddMemberDrawer({ open, gestionnaireId, onClose, onAdded }: {
  open: boolean; gestionnaireId: string; onClose: () => void; onAdded: () => void
}) {
  const db = supabase as any
  const [option, setOption] = useState<'adulte' | 'mineur' | null>(null)

  // Adulte (invitation)
  const [emailAdulte, setEmailAdulte] = useState('')
  const [lienAdulte, setLienAdulte]   = useState<string>('conjoint')
  const [inviting, setInviting]       = useState(false)

  // Mineur
  const [prenomMin, setPrenomMin]   = useState('')
  const [nomMin, setNomMin]         = useState('')
  const [dateNaiss, setDateNaiss]   = useState('')
  const [creatingMin, setCreatingMin] = useState(false)

  function reset() {
    setOption(null); setEmailAdulte(''); setLienAdulte('conjoint')
    setPrenomMin(''); setNomMin(''); setDateNaiss('')
  }

  useEffect(() => { if (!open) reset() }, [open])

  async function inviterAdulte() {
    if (!emailAdulte) return
    setInviting(true)
    const token = crypto.randomUUID()
    const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 48)

    await db.from('invitations_famille').insert({
      gestionnaire_id: gestionnaireId,
      email: emailAdulte,
      token,
      expires_at: expiresAt.toISOString(),
      statut: 'envoyee',
    })

    await db.from('membres_famille').insert({
      gestionnaire_id: gestionnaireId,
      membre_user_id: null,
      prenom: emailAdulte.split('@')[0],
      nom: '',
      date_naissance: '1990-01-01',
      lien: lienAdulte,
      est_mineur: false,
      statut: 'invitation_envoyee',
      droits: { voir_dossier: false, prendre_rdv: false, gerer_paiements: false },
    })

    // Déclenche l'envoi de l'email d'invitation
    try {
      await supabase.functions.invoke('send-family-invitation', {
        body: { email: emailAdulte, token, gestionnaireId },
      })
    } catch { /* L'email sera réessayé par le serveur */ }

    toast.success(`Invitation envoyée à ${emailAdulte}`)
    setInviting(false)
    onAdded(); onClose()
  }

  async function creerMineur() {
    if (!prenomMin || !nomMin || !dateNaiss) return
    setCreatingMin(true)
    const estMineur = differenceInYears(new Date(), new Date(dateNaiss)) < 18
    await db.from('membres_famille').insert({
      gestionnaire_id: gestionnaireId,
      membre_user_id: null,
      prenom: prenomMin,
      nom: nomMin,
      date_naissance: dateNaiss,
      lien: 'enfant',
      est_mineur: estMineur,
      statut: 'sans_compte',
      droits: { voir_dossier: true, prendre_rdv: true, gerer_paiements: true },
    })
    toast.success(`${prenomMin} ${nomMin} ajouté·e à votre famille.`)
    setCreatingMin(false)
    onAdded(); onClose()
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title="Ajouter un membre" size="md">
      <div className="flex flex-col gap-s-4">
        {!option && (
          <>
            <p className="text-small text-ink-2">Comment souhaitez-vous ajouter ce membre ?</p>
            <div className="grid grid-cols-2 gap-s-3">
              <button
                onClick={() => setOption('adulte')}
                className="flex flex-col items-center gap-s-3 rounded-md border border-line p-s-5 hover:bg-primary-soft hover:border-primary transition-colors"
              >
                <Mail className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-semibold text-ink text-small">Inviter un adulte</p>
                  <p className="text-micro text-ink-3 mt-s-0.5">Avec son propre compte</p>
                </div>
              </button>
              <button
                onClick={() => setOption('mineur')}
                className="flex flex-col items-center gap-s-3 rounded-md border border-line p-s-5 hover:bg-primary-soft hover:border-primary transition-colors"
              >
                <Baby className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-semibold text-ink text-small">Créer profil mineur</p>
                  <p className="text-micro text-ink-3 mt-s-0.5">Géré sans compte propre</p>
                </div>
              </button>
            </div>
          </>
        )}

        {option === 'adulte' && (
          <>
            <button onClick={() => setOption(null)} className="flex items-center gap-s-1 text-micro text-ink-3 hover:text-ink self-start">
              <ChevronRight className="h-3 w-3 rotate-180" /> Retour
            </button>
            <h3 className="font-semibold text-ink">Inviter un adulte</h3>
            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">Adresse e-mail</label>
              <input
                type="email"
                value={emailAdulte}
                onChange={e => setEmailAdulte(e.target.value)}
                placeholder="exemple@email.com"
                className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
              />
            </div>
            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">Lien de parenté</label>
              <select
                value={lienAdulte}
                onChange={e => setLienAdulte(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus"
              >
                <option value="conjoint">Conjoint·e</option>
                <option value="parent">Parent</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <p className="text-micro text-ink-3">
              Un lien d'invitation sera envoyé par e-mail. Il expire dans 48 heures.
            </p>
            <div className="flex gap-s-2">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button className="flex-1" leftIcon={<Mail className="h-4 w-4" />} onClick={inviterAdulte} loading={inviting} disabled={!emailAdulte}>
                Envoyer l'invitation
              </Button>
            </div>
          </>
        )}

        {option === 'mineur' && (
          <>
            <button onClick={() => setOption(null)} className="flex items-center gap-s-1 text-micro text-ink-3 hover:text-ink self-start">
              <ChevronRight className="h-3 w-3 rotate-180" /> Retour
            </button>
            <h3 className="font-semibold text-ink">Créer un profil mineur</h3>
            <div className="grid grid-cols-2 gap-s-2">
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Prénom *</label>
                <input value={prenomMin} onChange={e => setPrenomMin(e.target.value)} placeholder="Prénom"
                  className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus" />
              </div>
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Nom *</label>
                <input value={nomMin} onChange={e => setNomMin(e.target.value)} placeholder="Nom"
                  className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus" />
              </div>
            </div>
            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">Date de naissance *</label>
              <input type="date" value={dateNaiss} onChange={e => setDateNaiss(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus" />
            </div>
            <p className="text-micro text-ink-3">
              Ce profil sera géré directement par vous. Vous aurez tous les droits sur ce membre.
            </p>
            <div className="flex gap-s-2">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button className="flex-1" leftIcon={<Plus className="h-4 w-4" />} onClick={creerMineur} loading={creatingMin} disabled={!prenomMin || !nomMin || !dateNaiss}>
                Créer le profil
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── MemberCard ───────────────────────────────────────────────────────────────
function MemberCard({ membre, onViewDossier, onEditRights, onRemove }: {
  membre: MembreFamille
  onViewDossier: () => void
  onEditRights: () => void
  onRemove: () => void
}) {
  const st = STATUT_CONFIG[membre.statut]
  const ageMembre = age(membre.date_naissance)

  return (
    <div className="rounded-md border border-line bg-surface p-s-4">
      <div className="flex items-start gap-s-3">
        {/* Avatar */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary text-body">
          {initials(membre.prenom, membre.nom)}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-s-2">
            <p className="font-semibold text-ink">{membre.prenom} {membre.nom}</p>
            <span className="text-micro text-ink-3">{LIEN_LABELS[membre.lien] ?? membre.lien} · {ageMembre} ans</span>
          </div>
          <div className="mt-s-1 flex items-center gap-s-1.5">
            <span className={cn('h-2 w-2 rounded-full shrink-0', st.dot)} />
            <span className={cn('rounded-pill px-s-2 py-0.5 text-micro font-medium', st.cls)}>{st.label}</span>
          </div>
        </div>

        {/* Actions desktop */}
        <div className="hidden sm:flex items-center gap-s-1 shrink-0">
          {membre.droits.voir_dossier && (
            <button
              title="Voir le dossier"
              onClick={onViewDossier}
              className="flex items-center gap-s-1 rounded-md border border-line px-s-2 py-s-1 text-micro text-ink-2 hover:bg-surface-2 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" /> Dossier
            </button>
          )}
          <button
            title="Gérer les droits"
            onClick={onEditRights}
            className="flex items-center gap-s-1 rounded-md border border-line px-s-2 py-s-1 text-micro text-ink-2 hover:bg-surface-2 transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" /> Droits
          </button>
          <button
            title="Retirer"
            onClick={onRemove}
            className="rounded-md border border-line p-s-1 text-status-danger hover:bg-status-danger/5 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Actions mobile */}
      <div className="mt-s-3 flex flex-wrap gap-s-2 sm:hidden">
        {membre.droits.voir_dossier && (
          <Button size="sm" variant="secondary" leftIcon={<Eye className="h-4 w-4" />} onClick={onViewDossier}>Dossier</Button>
        )}
        <Button size="sm" variant="secondary" leftIcon={<Settings2 className="h-4 w-4" />} onClick={onEditRights}>Droits</Button>
        <Button size="sm" variant="secondary" leftIcon={<Trash2 className="h-4 w-4" />} onClick={onRemove}
          className="text-status-danger border-status-danger/30 hover:bg-status-danger/5">Retirer</Button>
      </div>

      {/* Droits actifs (résumé) */}
      <div className="mt-s-3 flex flex-wrap gap-s-1">
        {membre.droits.voir_dossier   && <span className="rounded-pill bg-surface-2 border border-line px-s-2 py-0.5 text-micro text-ink-2">Dossier</span>}
        {membre.droits.prendre_rdv    && <span className="rounded-pill bg-surface-2 border border-line px-s-2 py-0.5 text-micro text-ink-2">RDV</span>}
        {membre.droits.gerer_paiements && <span className="rounded-pill bg-surface-2 border border-line px-s-2 py-0.5 text-micro text-ink-2">Paiements</span>}
      </div>
    </div>
  )
}

// ─── MutuelleFamille ──────────────────────────────────────────────────────────
function MutuelleFamille({ patientId }: { patientId: string }) {
  const db = supabase as any
  const [ayants, setAyants] = useState<AyantDroit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    db.from('mutuelles_patients')
      .select('ayants_droit')
      .eq('patient_id', patientId)
      .eq('statut', 'active')
      .maybeSingle()
      .then(({ data }: any) => {
        setAyants(data?.ayants_droit ?? [])
        setLoading(false)
      })
  }, [patientId])

  if (loading) return <Skeleton className="h-32 rounded-md" />
  if (ayants.length === 0) return null

  return (
    <div className="rounded-md border border-line bg-surface p-s-4">
      <h3 className="mb-s-3 font-semibold text-ink">Ayants droit — Mutuelle familiale</h3>
      <div className="flex flex-col gap-s-3">
        {ayants.map((a, i) => {
          const pct = a.plafond_annuel > 0 ? Math.min((a.consommation_annuelle / a.plafond_annuel) * 100, 100) : 0
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-s-1 text-small">
                <span className="font-medium text-ink">{a.prenom} {a.nom}</span>
                <span className="text-ink-3">{Math.round(pct)}% du plafond</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-status-danger' : pct >= 70 ? 'bg-status-pending' : 'bg-status-success')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-s-0.5 text-micro text-ink-3">
                {new Intl.NumberFormat('fr-SN').format(a.consommation_annuelle)} F / {new Intl.NumberFormat('fr-SN').format(a.plafond_annuel)} F
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ConfirmRemoveModal ───────────────────────────────────────────────────────
function ConfirmRemoveModal({ membre, open, onClose, onConfirm, removing }: {
  membre: MembreFamille | null; open: boolean; onClose: () => void
  onConfirm: () => void; removing: boolean
}) {
  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title="Retirer ce membre" size="sm">
      <div className="flex flex-col gap-s-4">
        <p className="text-small text-ink-2">
          Voulez-vous retirer <strong className="text-ink">{membre?.prenom} {membre?.nom}</strong> de votre famille ?
          {membre?.membre_user_id && ' Cette personne sera notifiée et perdra l\'accès immédiatement.'}
        </p>
        <div className="flex gap-s-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={removing}>Annuler</Button>
          <Button className="flex-1 bg-status-danger hover:bg-status-danger/90" onClick={onConfirm} loading={removing}>
            Retirer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── FamilyPage ───────────────────────────────────────────────────────────────
export default function FamilyPage() {
  const db = supabase as any
  const { profile } = useAuth()

  const [membres, setMembres] = useState<MembreFamille[]>([])
  const [loading, setLoading] = useState(false)

  const [addOpen, setAddOpen]       = useState(false)
  const [rightsTarget, setRightsTarget] = useState<MembreFamille | null>(null)
  const [dossierTarget, setDossierTarget] = useState<MembreFamille | null>(null)
  const [removeTarget, setRemoveTarget]   = useState<MembreFamille | null>(null)
  const [removing, setRemoving]           = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await db.from('membres_famille')
      .select('*')
      .eq('gestionnaire_id', profile.id)
      .order('created_at', { ascending: true })
    setMembres(data ?? [])
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  function updateDroitsLocal(id: string, droits: Droits) {
    setMembres(prev => prev.map(m => m.id === id ? { ...m, droits } : m))
  }

  async function removeMembre() {
    if (!removeTarget) return
    setRemoving(true)
    await db.from('membres_famille').update({ deleted_at: new Date().toISOString() }).eq('id', removeTarget.id)

    // Notifier si membre avec compte (résoudre auth UUID → profiles.id)
    if (removeTarget.membre_user_id) {
      try {
        const { data: memberProfile } = await db.from('profiles').select('id').eq('user_id', removeTarget.membre_user_id).single()
        if (memberProfile?.id) {
          await db.from('notifications').insert({
            event_type: 'famille_retrait',
            title: 'Accès famille retiré',
            message: `Votre accès au dossier familial a été retiré.`,
            badge_category: 'famille',
            priority: 'normal',
            user_id: memberProfile.id,
            data: {},
          })
        }
      } catch { /* non-bloquant */ }
    }

    setMembres(prev => prev.filter(m => m.id !== removeTarget.id))
    setRemoveTarget(null)
    setRemoving(false)
    toast.success('Membre retiré de votre famille.')
  }

  const actifs    = membres.filter(m => m.statut === 'actif')
  const enAttente = membres.filter(m => m.statut === 'invitation_envoyee')
  const mineurs   = membres.filter(m => m.statut === 'sans_compte')

  return (
    <div className="flex flex-col gap-s-6 pb-s-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">Ma famille</h1>
          <p className="text-small text-ink-2 mt-s-0.5">
            {membres.length === 0
              ? 'Aucun membre rattaché'
              : `${membres.length} membre${membres.length > 1 ? 's' : ''} rattaché${membres.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
          Ajouter un membre
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-s-3">{[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-md" />)}</div>
      ) : membres.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Aucun membre rattaché"
          description="Ajoutez des membres de votre famille pour gérer leur suivi médical depuis votre compte."
        />
      ) : (
        <>
          {/* Membres actifs */}
          {actifs.length > 0 && (
            <div>
              <h2 className="mb-s-3 font-semibold text-ink text-small flex items-center gap-s-2">
                <span className="h-2 w-2 rounded-full bg-status-success" /> Membres actifs ({actifs.length})
              </h2>
              <div className="flex flex-col gap-s-3">
                {actifs.map(m => (
                  <MemberCard
                    key={m.id}
                    membre={m}
                    onViewDossier={() => setDossierTarget(m)}
                    onEditRights={() => setRightsTarget(m)}
                    onRemove={() => setRemoveTarget(m)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Invitations en attente */}
          {enAttente.length > 0 && (
            <div>
              <h2 className="mb-s-3 font-semibold text-ink text-small flex items-center gap-s-2">
                <span className="h-2 w-2 rounded-full bg-status-pending" /> Invitations en attente ({enAttente.length})
              </h2>
              <div className="flex flex-col gap-s-3">
                {enAttente.map(m => (
                  <MemberCard
                    key={m.id}
                    membre={m}
                    onViewDossier={() => setDossierTarget(m)}
                    onEditRights={() => setRightsTarget(m)}
                    onRemove={() => setRemoveTarget(m)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Profils mineurs */}
          {mineurs.length > 0 && (
            <div>
              <h2 className="mb-s-3 font-semibold text-ink text-small flex items-center gap-s-2">
                <span className="h-2 w-2 rounded-full bg-primary" /> Profils gérés ({mineurs.length})
              </h2>
              <div className="flex flex-col gap-s-3">
                {mineurs.map(m => (
                  <MemberCard
                    key={m.id}
                    membre={m}
                    onViewDossier={() => setDossierTarget(m)}
                    onEditRights={() => setRightsTarget(m)}
                    onRemove={() => setRemoveTarget(m)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Section mutuelle familiale */}
      {profile?.id && <MutuelleFamille patientId={profile.id} />}

      {/* Modals */}
      <AddMemberDrawer
        open={addOpen}
        gestionnaireId={profile?.id ?? ''}
        onClose={() => setAddOpen(false)}
        onAdded={load}
      />
      <RightsModal
        membre={rightsTarget}
        open={!!rightsTarget}
        onClose={() => setRightsTarget(null)}
        onSaved={updateDroitsLocal}
      />
      <DossierDrawer
        membre={dossierTarget}
        open={!!dossierTarget}
        onClose={() => setDossierTarget(null)}
      />
      <ConfirmRemoveModal
        membre={removeTarget}
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeMembre}
        removing={removing}
      />
    </div>
  )
}
