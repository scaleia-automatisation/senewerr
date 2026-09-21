import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, MapPin, Clock, Calendar, ChevronRight,
  CalendarDays, LogOut, Loader2, AlertTriangle,
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Horaire {
  jour: string
  ouverture?: string | null
  fermeture?: string | null
  ferme?: boolean
}

interface Etablissement {
  id: string
  etablissement_id: string
  nom: string
  adresse?: string | null
  ville?: string | null
  status: 'approved' | 'suspended' | 'pending'
  horaires_etablissement?: Horaire[] | null
  rdv_ce_mois: number
  prochain_creneau?: string | null
  mes_horaires?: Horaire[] | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function HoraireRow({ h }: { h: Horaire }) {
  return (
    <div className="flex items-center justify-between text-small py-0.5">
      <span className="text-ink-3 w-24">{h.jour}</span>
      {h.ferme
        ? <span className="text-ink-3 italic">Fermé</span>
        : <span className="font-medium text-ink">{h.ouverture} – {h.fermeture}</span>
      }
    </div>
  )
}

// ── Composant modal mes horaires ──────────────────────────────────────────────

function MesHorairesModal({
  open, onOpenChange, etablissementId, initial,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  etablissementId: string
  initial: Horaire[]
}) {
  const { profile } = useAuth()
  const db = supabase as any
  const [horaires, setHoraires] = useState<Horaire[]>(
    JOURS.map(j => initial.find(h => h.jour === j) ?? { jour: j, ouverture: '08:00', fermeture: '17:00', ferme: false })
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setHoraires(
      JOURS.map(j => initial.find(h => h.jour === j) ?? { jour: j, ouverture: '08:00', fermeture: '17:00', ferme: false })
    )
  }, [initial, open])

  function update(jour: string, field: keyof Horaire, val: string | boolean) {
    setHoraires(h => h.map(x => x.jour === jour ? { ...x, [field]: val } : x))
  }

  async function save() {
    setSaving(true)
    try {
      const { error } = await db.from('praticien_etablissements')
        .update({ mes_horaires: horaires })
        .eq('praticien_id', profile!.id)
        .eq('etablissement_id', etablissementId)
      if (error) throw error
      toast.success('Vos horaires ont été mis à jour')
      onOpenChange(false)
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Mes horaires dans cet établissement">
      <div className="flex flex-col gap-s-4 p-s-4">
        <p className="text-small text-ink-3">
          Ces horaires sont les vôtres dans cet établissement — ils ne modifient pas les horaires d'ouverture de l'établissement.
        </p>
        <div className="flex flex-col gap-s-2">
          {horaires.map(h => (
            <div key={h.jour} className="flex items-center gap-s-2">
              <span className="w-24 text-small text-ink shrink-0">{h.jour}</span>
              <label className="flex items-center gap-s-1 text-micro text-ink-3 shrink-0">
                <input
                  type="checkbox"
                  checked={!!h.ferme}
                  onChange={e => update(h.jour, 'ferme', e.target.checked)}
                  className="h-3 w-3 accent-primary"
                />
                Fermé
              </label>
              {!h.ferme && (
                <>
                  <input
                    type="time"
                    value={h.ouverture ?? ''}
                    onChange={e => update(h.jour, 'ouverture', e.target.value)}
                    className="rounded-md border border-line bg-surface px-s-2 py-s-1 text-small text-ink focus:border-primary focus:outline-none"
                  />
                  <span className="text-micro text-ink-3">–</span>
                  <input
                    type="time"
                    value={h.fermeture ?? ''}
                    onChange={e => update(h.jour, 'fermeture', e.target.value)}
                    className="rounded-md border border-line bg-surface px-s-2 py-s-1 text-small text-ink focus:border-primary focus:outline-none"
                  />
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            variant="primary"
            leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            disabled={saving}
            onClick={save}
          >
            {saving ? 'Enregistrement…' : 'Sauvegarder mes horaires'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function EtablissementsPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const db = supabase as any

  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [loading, setLoading] = useState(true)

  // Modal quitter
  const [leaveTarget, setLeaveTarget] = useState<Etablissement | null>(null)
  const [leaving, setLeaving]         = useState(false)
  const [leaveMotif, setLeaveMotif]   = useState('')

  // Modal mes horaires
  const [horaireTarget, setHoraireTarget] = useState<Etablissement | null>(null)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    const { data: rels } = await db.from('praticien_etablissements')
      .select(`
        id, status, mes_horaires,
        etablissement:etablissement_id (
          id, nom, adresse, ville, horaires
        )
      `)
      .eq('praticien_id', profile.id)
      .in('status', ['approved', 'suspended'])

    if (!rels || rels.length === 0) {
      setEtablissements([])
      setLoading(false)
      return
    }

    const now = new Date()
    const monthStart = startOfMonth(now).toISOString()
    const monthEnd   = endOfMonth(now).toISOString()

    const etabIds = rels.map((r: any) => r.etablissement?.id).filter(Boolean)

    // Compter les RDV de ce mois par établissement
    const { data: rdvData } = await db.from('appointments')
      .select('establishment_id')
      .eq('professional_id', profile.id)
      .in('establishment_id', etabIds)
      .gte('starts_at', monthStart)
      .lte('starts_at', monthEnd)

    const rdvByEtab: Record<string, number> = {}
    ;(rdvData ?? []).forEach((r: any) => {
      rdvByEtab[r.establishment_id] = (rdvByEtab[r.establishment_id] ?? 0) + 1
    })

    // Prochain créneau par établissement
    const { data: creneauxData } = await db.from('appointment_slots')
      .select('establishment_id, starts_at')
      .eq('professional_id', profile.id)
      .in('establishment_id', etabIds)
      .eq('status', 'available')
      .gte('starts_at', now.toISOString())
      .order('starts_at', { ascending: true })

    const prochainByEtab: Record<string, string> = {}
    ;(creneauxData ?? []).forEach((c: any) => {
      if (!prochainByEtab[c.establishment_id]) {
        prochainByEtab[c.establishment_id] = c.starts_at
      }
    })

    const result: Etablissement[] = rels.map((r: any) => ({
      id:                      r.id,
      etablissement_id:        r.etablissement?.id ?? '',
      nom:                     r.etablissement?.nom ?? '—',
      adresse:                 r.etablissement?.adresse,
      ville:                   r.etablissement?.ville,
      status:                  r.status,
      horaires_etablissement:  r.etablissement?.horaires ?? [],
      rdv_ce_mois:             rdvByEtab[r.etablissement?.id] ?? 0,
      prochain_creneau:        prochainByEtab[r.etablissement?.id] ?? null,
      mes_horaires:            r.mes_horaires ?? [],
    }))

    setEtablissements(result)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  async function handleLeave() {
    if (!leaveTarget || !profile?.id) return
    setLeaving(true)
    try {
      const { error } = await db.from('praticien_etablissements')
        .update({ status: 'left', left_at: new Date().toISOString(), motif_depart: leaveMotif.trim() || null })
        .eq('id', leaveTarget.id)
        .eq('praticien_id', profile.id)

      if (error) throw error

      // Audit log
      await db.from('audit_logs').insert({
        actor_id:   profile.id,
        action:     'praticien_left_etablissement',
        table_name: 'praticien_etablissements',
        metadata:   { etablissement_id: leaveTarget.etablissement_id, motif: leaveMotif.trim() || null },
      }).catch(() => {})

      toast.success(`Vous avez quitté ${leaveTarget.nom}`)
      setLeaveTarget(null)
      setLeaveMotif('')
      await load()
    } catch {
      toast.error('Erreur lors de la demande de départ')
    } finally {
      setLeaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-s-4 p-s-6">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    )
  }

  if (etablissements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-s-4 p-s-12 text-center">
        <Building2 className="h-12 w-12 text-ink-3 opacity-30" />
        <p className="text-h4 font-semibold text-ink">Aucun établissement</p>
        <p className="text-small text-ink-3 max-w-xs">
          Vous n'êtes rattaché à aucun établissement pour le moment.
          Les établissements vous invitent via leur tableau de bord.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-s-6 p-s-4 md:p-s-6">

      <div className="flex items-center justify-between">
        <h1 className="text-h3 font-semibold text-ink">Mes établissements</h1>
        <p className="text-small text-ink-3">{etablissements.length} établissement{etablissements.length !== 1 ? 's' : ''}</p>
      </div>

      {etablissements.map(etab => (
        <Card key={etab.id} className="p-s-5 flex flex-col gap-s-4">

          {/* ── Header établissement ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-s-3">
            <div className="flex items-center gap-s-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">{etab.nom}</h2>
                {(etab.adresse || etab.ville) && (
                  <p className="flex items-center gap-s-1 text-small text-ink-3">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[etab.adresse, etab.ville].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <Badge variant={etab.status === 'approved' ? 'success' : 'danger'}>
              {etab.status === 'approved' ? 'Actif' : 'Suspendu'}
            </Badge>
          </div>

          {/* ── Stats ────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-2 p-s-3 text-center">
              <p className="text-h4 font-bold text-primary">{etab.rdv_ce_mois}</p>
              <p className="text-micro text-ink-3">RDV ce mois</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-s-3 text-center">
              <p className="text-small font-semibold text-ink">
                {etab.prochain_creneau
                  ? format(parseISO(etab.prochain_creneau), 'dd/MM HH:mm', { locale: fr })
                  : '—'
                }
              </p>
              <p className="text-micro text-ink-3">Prochain créneau</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-s-3 text-center col-span-2 sm:col-span-1">
              <p className="text-small font-semibold text-ink capitalize">
                {format(new Date(), 'MMMM yyyy', { locale: fr })}
              </p>
              <p className="text-micro text-ink-3">Période</p>
            </div>
          </div>

          {/* ── Horaires établissement (READ-ONLY) ───────────────────────────── */}
          {etab.horaires_etablissement && etab.horaires_etablissement.length > 0 && (
            <div>
              <div className="flex items-center gap-s-2 mb-s-2">
                <Clock className="h-4 w-4 text-ink-3" />
                <p className="text-small font-semibold text-ink">Horaires de l'établissement</p>
                <span className="text-micro text-ink-3 italic">(lecture seule)</span>
              </div>
              <div className="divide-y divide-line rounded-lg border border-line px-s-3 py-s-1">
                {etab.horaires_etablissement.map(h => (
                  <HoraireRow key={h.jour} h={h} />
                ))}
              </div>
            </div>
          )}

          {/* ── Actions ──────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-s-2">
            <Button
              variant="secondary"
              leftIcon={<CalendarDays className="h-4 w-4" />}
              onClick={() => setHoraireTarget(etab)}
            >
              Modifier mes horaires
            </Button>
            <Button
              variant="ghost"
              leftIcon={<Calendar className="h-4 w-4" />}
              onClick={() => navigate('/pro/agenda')}
            >
              Voir l'agenda
            </Button>
            {etab.status === 'approved' && (
              <Button
                variant="danger"
                leftIcon={<LogOut className="h-4 w-4" />}
                onClick={() => { setLeaveTarget(etab); setLeaveMotif('') }}
              >
                Quitter cet établissement
              </Button>
            )}
          </div>
        </Card>
      ))}

      {/* ── Modal Quitter ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!leaveTarget}
        onOpenChange={open => { if (!open) { setLeaveTarget(null); setLeaveMotif('') } }}
        title="Quitter l'établissement"
      >
        {leaveTarget && (
          <div className="flex flex-col gap-s-4 p-s-4">
            <div className="flex items-start gap-s-3 rounded-lg border border-danger/30 bg-danger/5 p-s-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-danger mt-0.5" />
              <div>
                <p className="text-small font-semibold text-ink">Confirmer le départ</p>
                <p className="text-small text-ink-3 mt-s-1">
                  Vous allez quitter <strong className="text-ink">{leaveTarget.nom}</strong>.
                  Vos rendez-vous existants ne seront pas annulés automatiquement.
                  L'établissement sera notifié de votre départ.
                </p>
              </div>
            </div>
            <textarea
              value={leaveMotif}
              onChange={e => setLeaveMotif(e.target.value)}
              placeholder="Motif du départ (optionnel)"
              rows={3}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => { setLeaveTarget(null); setLeaveMotif('') }}>
                Annuler
              </Button>
              <Button
                variant="danger"
                leftIcon={leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                disabled={leaving}
                onClick={handleLeave}
              >
                {leaving ? 'Départ en cours…' : 'Confirmer le départ'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Mes horaires ─────────────────────────────────────────────────── */}
      {horaireTarget && (
        <MesHorairesModal
          open={!!horaireTarget}
          onOpenChange={open => { if (!open) setHoraireTarget(null) }}
          etablissementId={horaireTarget.etablissement_id}
          initial={horaireTarget.mes_horaires ?? []}
        />
      )}
    </div>
  )
}
