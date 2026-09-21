import { useState, useEffect, useCallback, useMemo } from 'react'
import { differenceInYears, parseISO, subDays, isAfter, formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, User, AlertTriangle, ChevronLeft, Plus, FileText,
  Activity, Clock, Pill, ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientListItem {
  patient_id: string
  full_name: string
  phone: string | null
  date_of_birth: string | null
  last_dispensation: string
  allergies: string[] | null
}

interface DossierDispensation {
  id: string
  date_dispensation: string
  medicaments_delivres: { nom: string; quantite_servie: number }[] | null
  montant_total: number | null
}

interface Dossier {
  patient: {
    id: string
    full_name: string
    phone: string | null
    date_of_birth: string | null
    blood_type: string | null
    allergies: string[] | null
    chronic_conditions: string[] | null
  }
  dispensations: DossierDispensation[]
  fiche: {
    id?: string
    notes_pharmacien: string | null
    interactions_signalees: { medicament_a: string; medicament_b: string; description: string; date: string }[] | null
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAge(dob: string | null): number | null {
  if (!dob) return null
  try { return differenceInYears(new Date(), parseISO(dob)) } catch { return null }
}

function getInitials(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

function allergyAlertMeds(dossier: Dossier): string[] {
  const allergies = (dossier.patient.allergies ?? []).map(a => a.toLowerCase())
  if (!allergies.length) return []
  const since90 = subDays(new Date(), 90)
  const recentMeds = dossier.dispensations
    .filter(d => isAfter(parseISO(d.date_dispensation), since90))
    .flatMap(d => (d.medicaments_delivres ?? []).map(m => m.nom.toLowerCase()))
  return dossier.dispensations
    .flatMap(d => d.medicaments_delivres ?? [])
    .map(m => m.nom)
    .filter(nom => allergies.some(a => nom.toLowerCase().includes(a)))
    .filter(nom => recentMeds.some(r => r.includes(nom.toLowerCase())))
}

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(Math.round(n)) + ' FCFA'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PharmacyPatientsPage() {
  const { profile } = useAuth()
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  const [patients, setPatients] = useState<PatientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [loadingDossier, setLoadingDossier] = useState(false)
  const [dossierError, setDossierError] = useState<string | null>(null)

  // Notes pharmacien
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesEditing, setNotesEditing] = useState(false)

  // Modal interaction
  const [interModal, setInterModal] = useState(false)
  const [interA, setInterA] = useState('')
  const [interB, setInterB] = useState('')
  const [interDesc, setInterDesc] = useState('')
  const [submittingInter, setSubmittingInter] = useState(false)

  // ── Load patient list ─────────────────────────────────────────────────────────
  const loadPatients = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoading(true)

    // 1. Unique patient_ids + last dispensation
    const { data: dispData, error: dispErr } = await db
      .from('dispensations')
      .select('patient_id, date_dispensation')
      .eq('pharmacie_id', pharmacie.id)
      .order('date_dispensation', { ascending: false })
      .limit(2000)

    if (dispErr) { toast.error('Erreur de chargement.'); setLoading(false); return }

    const patientMap = new Map<string, string>()
    ;(dispData ?? []).forEach((d: any) => {
      if (!patientMap.has(d.patient_id)) patientMap.set(d.patient_id, d.date_dispensation)
    })
    const patientIds = Array.from(patientMap.keys())
    if (!patientIds.length) { setPatients([]); setLoading(false); return }

    // 2. Fetch profiles for names/phones
    const { data: profileData } = await db
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', patientIds)

    // 3. Fetch patients for medical info
    const { data: patientData } = await db
      .from('patients')
      .select('profile_id, date_of_birth, allergies')
      .in('profile_id', patientIds)

    const profileMap = new Map<string, { full_name: string; phone: string | null }>(
      (profileData ?? []).map((p: any) => [p.id as string, p as { full_name: string; phone: string | null }])
    )
    const patientMedMap = new Map<string, { date_of_birth: string | null; allergies: string[] | null }>(
      (patientData ?? []).map((p: any) => [p.profile_id as string, p as { date_of_birth: string | null; allergies: string[] | null }])
    )

    const list: PatientListItem[] = patientIds.map(pid => {
      const p = profileMap.get(pid)
      const med = patientMedMap.get(pid)
      return {
        patient_id: pid,
        full_name: p?.full_name ?? `Patient ${pid.slice(0, 6).toUpperCase()}`,
        phone: p?.phone ?? null,
        date_of_birth: med?.date_of_birth ?? null,
        last_dispensation: patientMap.get(pid) ?? '',
        allergies: med?.allergies ?? null,
      }
    })

    // Sort by last dispensation desc
    list.sort((a, b) => new Date(b.last_dispensation).getTime() - new Date(a.last_dispensation).getTime())
    setPatients(list)
    setLoading(false)
  }, [pharmacie?.id])

  useEffect(() => { loadPatients() }, [loadPatients])

  // ── Load dossier ──────────────────────────────────────────────────────────────
  const loadDossier = useCallback(async (patientId: string) => {
    setLoadingDossier(true)
    setDossierError(null)
    setDossier(null)

    const { data, error } = await supabase.functions.invoke('get-patient-for-pharmacien', {
      body: { patient_id: patientId, pharmacie_id: pharmacie?.id },
    })

    if (error) {
      setDossierError('Impossible de charger le dossier. Vérifiez vos droits d\'accès.')
      setLoadingDossier(false)
      return
    }

    if (data?.error) {
      setDossierError(
        data.code === 403
          ? 'Accès refusé — aucune dispensation dans les 90 derniers jours pour ce patient.'
          : data.error,
      )
      setLoadingDossier(false)
      return
    }

    setDossier(data as Dossier)
    setNotes(data.fiche?.notes_pharmacien ?? '')
    setLoadingDossier(false)
  }, [pharmacie?.id])

  useEffect(() => {
    if (selectedId) loadDossier(selectedId)
    else { setDossier(null); setDossierError(null) }
  }, [selectedId, loadDossier])

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (search.length < 3) return patients
    const q = search.toLowerCase()
    return patients.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      (p.phone?.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ?? false)
    )
  }, [patients, search])

  // ── Save notes ────────────────────────────────────────────────────────────────
  async function saveNotes() {
    if (!selectedId || !pharmacie?.id) return
    setSavingNotes(true)
    const fiche = dossier?.fiche
    const payload = { notes_pharmacien: notes, updated_at: new Date().toISOString() }

    if (fiche?.id) {
      await db.from('fiches_patients_pharmacie').update(payload).eq('id', fiche.id)
    } else {
      await db.from('fiches_patients_pharmacie').insert({
        patient_id: selectedId,
        pharmacie_id: pharmacie.id,
        pharmacien_id: profile?.id,
        ...payload,
      })
    }

    setSavingNotes(false)
    setNotesEditing(false)
    toast.success('Notes enregistrées.')
    loadDossier(selectedId)
  }

  // ── Signaler une interaction ──────────────────────────────────────────────────
  async function signalerInteraction() {
    if (!interA.trim() || !interB.trim() || !interDesc.trim()) {
      toast.error('Tous les champs sont requis.')
      return
    }
    setSubmittingInter(true)
    const { error } = await supabase.functions.invoke('signal-interaction', {
      body: {
        patient_id: selectedId,
        pharmacie_id: pharmacie?.id,
        pharmacien_id: profile?.id,
        medicament_a: interA.trim(),
        medicament_b: interB.trim(),
        description: interDesc.trim(),
      },
    })
    if (error) { toast.error('Erreur lors du signalement.'); setSubmittingInter(false); return }
    toast.success('Interaction signalée. Praticien, patient et admin notifiés.')
    setSubmittingInter(false)
    setInterModal(false)
    setInterA(''); setInterB(''); setInterDesc('')
    if (selectedId) loadDossier(selectedId)
  }

  // ── Allergy alert ─────────────────────────────────────────────────────────────
  const allergyAlerts = dossier ? allergyAlertMeds(dossier) : []

  // ─────────────────────────────────────────────────────────────────────────────
  // Render — liste
  // ─────────────────────────────────────────────────────────────────────────────

  function renderList() {
    return (
      <div className="flex flex-col gap-s-3">
        <div className="relative">
          <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (nom, téléphone — min. 3 car.)"
            className="w-full rounded border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {search.length > 0 && search.length < 3 && (
          <p className="text-micro text-ink-3 pl-s-1">Saisissez au moins 3 caractères.</p>
        )}

        {loading ? (
          <div className="flex flex-col gap-s-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-s-3 py-s-12 text-ink-3">
            <User className="h-10 w-10 opacity-30" />
            <p className="text-small">
              {search.length >= 3 ? 'Aucun patient trouvé.' : 'Aucun patient dans cette pharmacie.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-s-2">
            {filtered.map(p => {
              const age = getAge(p.date_of_birth)
              const initials = getInitials(p.full_name)
              const hasAllergy = p.allergies && p.allergies.length > 0
              return (
                <motion.div
                  key={p.patient_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-s-3 rounded-lg border border-line bg-surface px-s-4 py-s-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-small">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-s-2">
                      <p className="font-medium text-small text-ink truncate">{p.full_name}</p>
                      {hasAllergy && (
                        <span title={`Allergies : ${p.allergies!.join(', ')}`}>
                          <AlertTriangle className="h-3.5 w-3.5 text-status-danger shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-micro text-ink-3">
                      {age != null ? `${age} ans` : ''}
                      {age != null && p.phone ? ' · ' : ''}
                      {p.phone ?? ''}
                    </p>
                    <p className="text-micro text-ink-3">
                      Dernière dispensation :{' '}
                      {formatDistanceToNow(parseISO(p.last_dispensation), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<FileText className="h-4 w-4" />}
                    onClick={() => setSelectedId(p.patient_id)}
                  >
                    Dossier
                  </Button>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render — dossier
  // ─────────────────────────────────────────────────────────────────────────────

  function renderDossier() {
    const patientListItem = patients.find(p => p.patient_id === selectedId)

    return (
      <div className="flex flex-col gap-s-4">

        {/* Back + title */}
        <div className="flex items-center gap-s-3">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-s-1 text-small text-ink-3 hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
          {patientListItem && (
            <div className="flex items-center gap-s-2 ml-s-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-small font-semibold text-primary">
                {getInitials(patientListItem.full_name)}
              </div>
              <div>
                <p className="font-semibold text-ink">{patientListItem.full_name}</p>
                {getAge(patientListItem.date_of_birth) != null && (
                  <p className="text-micro text-ink-3">{getAge(patientListItem.date_of_birth)} ans</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error state */}
        {dossierError && (
          <div className="flex items-start gap-s-3 rounded-lg border border-status-danger/30 bg-status-danger/5 p-s-4">
            <ShieldAlert className="h-5 w-5 shrink-0 text-status-danger mt-0.5" />
            <p className="text-small text-status-danger">{dossierError}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loadingDossier && (
          <div className="flex flex-col gap-s-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        )}

        {/* Dossier content */}
        {dossier && !loadingDossier && (
          <>
            {/* Alerte allergie */}
            {allergyAlerts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-s-3 rounded-lg border-2 border-status-danger bg-status-danger/5 p-s-4"
              >
                <AlertTriangle className="h-5 w-5 shrink-0 text-status-danger mt-0.5" />
                <div>
                  <p className="font-semibold text-status-danger">Alerte allergie</p>
                  <p className="mt-s-0.5 text-small text-status-danger">
                    Le patient est allergique à un médicament récemment dispensé :
                    {' '}<strong>{allergyAlerts.join(', ')}</strong>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Informations médicales */}
            <div className="rounded-lg border border-line bg-surface">
              <div className="border-b border-line px-s-4 py-s-3">
                <h2 className="flex items-center gap-s-2 font-semibold text-ink">
                  <Activity className="h-4 w-4 text-primary" />
                  Informations médicales
                </h2>
              </div>
              <div className="flex flex-col gap-s-4 px-s-4 py-s-4">

                {/* Groupe sanguin */}
                {dossier.patient.blood_type && (
                  <div>
                    <p className="text-micro text-ink-3">Groupe sanguin</p>
                    <span className="mt-s-1 inline-block rounded-full bg-status-danger/10 px-s-3 py-s-0.5 text-small font-semibold text-status-danger">
                      {dossier.patient.blood_type}
                    </span>
                  </div>
                )}

                {/* Allergies */}
                <div>
                  <p className="mb-s-2 text-micro text-ink-3">Allergies connues</p>
                  {(dossier.patient.allergies ?? []).length === 0 ? (
                    <p className="text-small text-ink-3">Aucune allergie déclarée</p>
                  ) : (
                    <div className="flex flex-wrap gap-s-2">
                      {dossier.patient.allergies!.map(a => (
                        <span
                          key={a}
                          className="rounded-full border border-status-danger/40 bg-status-danger/10 px-s-3 py-s-0.5 text-small font-medium text-status-danger"
                        >
                          ⚠ {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conditions chroniques / traitements en cours */}
                <div>
                  <p className="mb-s-2 text-micro text-ink-3">Conditions chroniques / traitements en cours</p>
                  {(dossier.patient.chronic_conditions ?? []).length === 0 ? (
                    <p className="text-small text-ink-3">Aucune condition déclarée</p>
                  ) : (
                    <div className="flex flex-wrap gap-s-2">
                      {dossier.patient.chronic_conditions!.map(c => (
                        <span
                          key={c}
                          className="rounded-full bg-surface-2 border border-line px-s-3 py-s-0.5 text-small text-ink-2"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Historique dispensations */}
            <div className="rounded-lg border border-line bg-surface">
              <div className="border-b border-line px-s-4 py-s-3">
                <h2 className="flex items-center gap-s-2 font-semibold text-ink">
                  <Clock className="h-4 w-4 text-primary" />
                  Historique dispensations dans cette pharmacie
                </h2>
              </div>
              {dossier.dispensations.length === 0 ? (
                <p className="px-s-4 py-s-4 text-small text-ink-3">Aucune dispensation enregistrée.</p>
              ) : (
                <div className="divide-y divide-line">
                  {dossier.dispensations.slice(0, 10).map(d => {
                    const meds = Array.isArray(d.medicaments_delivres) ? d.medicaments_delivres : []
                    return (
                      <div key={d.id} className="px-s-4 py-s-3">
                        <div className="flex items-center justify-between">
                          <p className="text-small font-medium text-ink">
                            {format(parseISO(d.date_dispensation), 'dd/MM/yyyy', { locale: fr })}
                          </p>
                          {d.montant_total != null && (
                            <span className="text-small text-ink-2">{formatFCFA(d.montant_total)}</span>
                          )}
                        </div>
                        {meds.length > 0 && (
                          <p className="mt-s-0.5 text-micro text-ink-3">
                            <Pill className="mr-s-1 inline h-3 w-3" />
                            {meds.map(m => `${m.nom} ×${m.quantite_servie}`).join(', ')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Notes pharmacien */}
            <div className="rounded-lg border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-s-4 py-s-3">
                <h2 className="font-semibold text-ink">Notes pharmacien</h2>
                <p className="text-micro text-ink-3">Visibles uniquement par vous</p>
              </div>
              <div className="flex flex-col gap-s-3 px-s-4 py-s-4">
                {notesEditing ? (
                  <>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Observance du patient, remarques sur la dispensation, contexte clinique…"
                      autoFocus
                      className="resize-none rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-s-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={saveNotes}
                        loading={savingNotes}
                      >
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setNotesEditing(false)
                        setNotes(dossier.fiche?.notes_pharmacien ?? '')
                      }}>
                        Annuler
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {notes ? (
                      <p className="whitespace-pre-wrap rounded bg-surface-2 px-s-3 py-s-2 text-small text-ink">
                        {notes}
                      </p>
                    ) : (
                      <p className="text-small text-ink-3 italic">Aucune note. Cliquez sur Modifier pour en ajouter.</p>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Plus className="h-4 w-4" />}
                      onClick={() => setNotesEditing(true)}
                      className="self-start"
                    >
                      {notes ? 'Modifier' : 'Ajouter une note'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Interactions signalées */}
            {(dossier.fiche?.interactions_signalees ?? []).length > 0 && (
              <div className="rounded-lg border border-status-warning/30 bg-surface">
                <div className="border-b border-status-warning/30 px-s-4 py-s-3">
                  <h2 className="flex items-center gap-s-2 font-semibold text-status-warning">
                    <ShieldAlert className="h-4 w-4" />
                    Interactions signalées
                  </h2>
                </div>
                <div className="divide-y divide-line">
                  {dossier.fiche!.interactions_signalees!.map((inter, i) => (
                    <div key={i} className="px-s-4 py-s-3">
                      <p className="text-small font-medium text-ink">
                        {inter.medicament_a} ↔ {inter.medicament_b}
                      </p>
                      <p className="text-micro text-ink-2">{inter.description}</p>
                      {inter.date && (
                        <p className="text-micro text-ink-3">
                          {format(parseISO(inter.date), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bouton signaler interaction */}
            <Button
              variant="secondary"
              leftIcon={<ShieldAlert className="h-4 w-4" />}
              onClick={() => setInterModal(true)}
              className="self-start"
            >
              Signaler une interaction médicamenteuse
            </Button>
          </>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">
      <h1 className="font-display text-h1 font-semibold text-ink">Patients</h1>

      <AnimatePresence mode="wait">
        {selectedId ? (
          <motion.div key="dossier" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {renderDossier()}
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
            {renderList()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Signaler interaction ────────────────────────────────────────── */}
      <Modal
        open={interModal}
        onOpenChange={open => { if (!open) { setInterModal(false); setInterA(''); setInterB(''); setInterDesc('') } }}
        title="Signaler une interaction médicamenteuse"
      >
        <div className="flex flex-col gap-s-4">
          <p className="text-small text-ink-2">
            Le praticien prescripteur, le patient et l'administrateur seront notifiés.
            Ce signalement sera consigné dans le dossier patient.
          </p>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Médicament A</label>
            <input
              type="text"
              value={interA}
              onChange={e => setInterA(e.target.value)}
              placeholder="ex: Warfarine"
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Médicament B</label>
            <input
              type="text"
              value={interB}
              onChange={e => setInterB(e.target.value)}
              placeholder="ex: Aspirine"
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Description de l'interaction</label>
            <textarea
              value={interDesc}
              onChange={e => setInterDesc(e.target.value)}
              rows={3}
              placeholder="Risque hémorragique augmenté en association avec les AINS…"
              className="resize-none rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => { setInterModal(false); setInterA(''); setInterB(''); setInterDesc('') }}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={signalerInteraction}
              loading={submittingInter}
              leftIcon={<ShieldAlert className="h-4 w-4" />}
            >
              Signaler
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
