import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/mutuelle/ConfirmModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Mutuelle {
  id: string
  nom: string
  description?: string
  adresse?: string
  telephone?: string
  email_contact?: string
  numero_agrement?: string
  logo_url?: string
  paiement_config?: Record<string, unknown>
  tp_rules?: Record<string, unknown>
  regles_metier?: Record<string, unknown>
}

interface Gestionnaire {
  id: string
  full_name: string
  email: string
  actif: boolean
}

// ── Sections nav ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'infos', label: 'Informations générales', icon: '🏢' },
  { id: 'gestionnaires', label: 'Gestionnaires', icon: '👤' },
  { id: 'paiements', label: 'Config. paiements', icon: '💳' },
  { id: 'regles', label: 'Règles métier', icon: '⚙️' },
  { id: 'integrations', label: 'Intégrations', icon: '🔌' },
  { id: 'danger', label: 'Zone de danger', icon: '⚠️' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MutuelleParametresPage() {
  const [section, setSection] = useState('infos')
  const [mutuelle, setMutuelle] = useState<Mutuelle | null>(null)
  const [mutuelleId, setMutuelleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await (supabase as any).from('profiles')
        .select('id, mutuelle_id').eq('user_id', user.id).single()
      let mid = prof?.mutuelle_id
      if (!mid) {
        const { data: mg } = await (supabase as any).from('mutuelles_gestionnaires')
          .select('mutuelle_id').eq('gestionnaire_id', prof?.id).eq('actif', true).limit(1).single()
        mid = mg?.mutuelle_id
      }
      if (!mid) { setLoading(false); return }
      setMutuelleId(mid)
      const { data: m } = await (supabase as any).from('mutuelles')
        .select('id, nom, description, adresse, telephone, email_contact, numero_agrement, logo_url, paiement_config, tp_rules, regles_metier')
        .eq('id', mid).single()
      setMutuelle(m ?? null)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!mutuelle) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
      <p className="text-gray-400">Mutuelle introuvable.</p>
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar nav */}
      <div className="lg:w-52 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2 space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                section === s.id
                  ? 'bg-blue-600 text-white'
                  : s.id === 'danger'
                    ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {section === 'infos' && <InfosSection mutuelle={mutuelle} onUpdate={setMutuelle} />}
            {section === 'gestionnaires' && <GestionnairesSection mutuelleId={mutuelleId!} />}
            {section === 'paiements' && <PaiementsSection mutuelle={mutuelle} onUpdate={setMutuelle} />}
            {section === 'regles' && <ReglesSection mutuelle={mutuelle} onUpdate={setMutuelle} />}
            {section === 'integrations' && <IntegrationsSection />}
            {section === 'danger' && <DangerSection mutuelleId={mutuelleId!} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Section A : Informations générales ───────────────────────────────────────

function InfosSection({ mutuelle, onUpdate }: { mutuelle: Mutuelle; onUpdate: (m: Mutuelle) => void }) {
  const [nom, setNom] = useState(mutuelle.nom ?? '')
  const [description, setDescription] = useState(mutuelle.description ?? '')
  const [adresse, setAdresse] = useState(mutuelle.adresse ?? '')
  const [telephone, setTelephone] = useState(mutuelle.telephone ?? '')
  const [emailContact, setEmailContact] = useState(mutuelle.email_contact ?? '')
  const [agrement, setAgrement] = useState(mutuelle.numero_agrement ?? '')
  const [logoUrl, setLogoUrl] = useState(mutuelle.logo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo trop volumineux (max 2 Mo)'); return }
    setUploading(true)
    const path = `${mutuelle.id}/logo/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('mutuelle-docs').upload(path, file, { upsert: true })
    if (error) { toast.error('Erreur upload logo'); setUploading(false); return }
    const { data: signed } = await supabase.storage.from('mutuelle-docs').createSignedUrl(path, 3600 * 24 * 365)
    setLogoUrl(signed?.signedUrl ?? '')
    setUploading(false)
    toast.success('Logo uploadé')
  }

  const save = async () => {
    if (!nom.trim()) { toast.error('Le nom est requis'); return }
    setSaving(true)
    const { data, error } = await supabase.functions.invoke('update-mutuelle-infos', {
      body: { nom: nom.trim(), description: description.trim(), adresse: adresse.trim(), telephone: telephone.trim(), email_contact: emailContact.trim(), numero_agrement: agrement.trim(), logo_url: logoUrl },
    })
    setSaving(false)
    if (error) { toast.error('Erreur enregistrement'); return }
    onUpdate({ ...mutuelle, ...(data.data ?? data) })
    toast.success('Informations enregistrées')
  }

  return (
    <Card title="Informations générales">
      {/* Logo */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-xl border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-700 flex-shrink-0">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            : <span className="text-2xl">🏢</span>}
        </div>
        <div>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Upload…' : 'Changer le logo'}
          </Button>
          <p className="text-xs text-gray-400 mt-1">PNG/JPG, max 2 Mo</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nom de la mutuelle *">
          <input type="text" value={nom} onChange={e => setNom(e.target.value)} className={inputCls} />
        </Field>
        <Field label="N° agrément MSAS">
          <input type="text" value={agrement} onChange={e => setAgrement(e.target.value)} placeholder="Ex : MSAS-2024-001" className={inputCls} />
        </Field>
        <Field label="Téléphone">
          <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+221 XX XXX XX XX" className={inputCls} />
        </Field>
        <Field label="Email de contact">
          <input type="email" value={emailContact} onChange={e => setEmailContact(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Adresse siège" className="sm:col-span-2">
          <input type="text" value={adresse} onChange={e => setAdresse(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Description courte" className="sm:col-span-2">
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputCls} />
        </Field>
      </div>

      <div className="flex justify-end mt-6">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </Card>
  )
}

// ── Section B : Gestionnaires ─────────────────────────────────────────────────

function GestionnairesSection({ mutuelleId }: { mutuelleId: string }) {
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNom, setInviteNom] = useState('')
  const [inviting, setInviting] = useState(false)
  const [confirmRetirer, setConfirmRetirer] = useState<Gestionnaire | null>(null)
  const [retirant, setRetirant] = useState(false)

  const myProfileId = useRef<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await (supabase as any).from('profiles').select('id').eq('user_id', user.id).single()
        myProfileId.current = p?.id ?? null
      }
      loadList()
    }
    init()
  }, []) // eslint-disable-line

  const loadList = async () => {
    setLoading(true)
    const { data } = await (supabase as any).from('mutuelles_gestionnaires')
      .select('gestionnaire_id, actif, profiles!mutuelles_gestionnaires_gestionnaire_id_fkey(id, full_name, email)')
      .eq('mutuelle_id', mutuelleId)
      .eq('actif', true)
    const list: Gestionnaire[] = (data ?? []).map((row: any) => ({
      id: row.gestionnaire_id,
      full_name: row.profiles?.full_name ?? '—',
      email: row.profiles?.email ?? '—',
      actif: row.actif,
    }))
    setGestionnaires(list)
    setLoading(false)
  }

  const invite = async () => {
    if (!inviteEmail.includes('@')) { toast.error('Email invalide'); return }
    setInviting(true)
    const { error } = await supabase.functions.invoke('invite-gestionnaire', {
      body: { email: inviteEmail.trim(), nom: inviteNom.trim() },
    })
    setInviting(false)
    if (error) { toast.error('Erreur invitation : ' + error.message); return }
    toast.success(`Invitation envoyée à ${inviteEmail}`)
    setShowInvite(false); setInviteEmail(''); setInviteNom('')
  }

  const retirer = async () => {
    if (!confirmRetirer) return
    setRetirant(true)
    const { error } = await supabase.functions.invoke('retirer-gestionnaire', {
      body: { gestionnaireId: confirmRetirer.id },
    })
    setRetirant(false)
    if (error) { toast.error(error.message); setConfirmRetirer(null); return }
    toast.success('Accès retiré')
    setConfirmRetirer(null)
    loadList()
  }

  return (
    <Card title="Gestionnaires de la mutuelle">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{gestionnaires.length} gestionnaire(s) actif(s)</p>
        <Button variant="primary" onClick={() => setShowInvite(true)}>+ Inviter</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />)}</div>
      ) : gestionnaires.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Aucun gestionnaire trouvé</p>
      ) : (
        <div className="space-y-2">
          {gestionnaires.map(g => (
            <div key={g.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{g.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{g.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {g.id === myProfileId.current && (
                  <span className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Vous</span>
                )}
                {g.id !== myProfileId.current && (
                  <Button variant="ghost" onClick={() => setConfirmRetirer(g)}>Retirer accès</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal invitation */}
      <Modal open={showInvite} onOpenChange={setShowInvite} title="Inviter un gestionnaire" size="sm">
        <div className="space-y-4 p-4">
          <Field label="Email *">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="gestionnaire@exemple.com" className={inputCls} />
          </Field>
          <Field label="Nom complet (optionnel)">
            <input type="text" value={inviteNom} onChange={e => setInviteNom(e.target.value)} className={inputCls} />
          </Field>
          <p className="text-xs text-gray-400">Un email d'invitation sera envoyé. L'accès sera activé à l'acceptation.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowInvite(false)}>Annuler</Button>
            <Button variant="primary" onClick={invite} disabled={inviting || !inviteEmail}>
              {inviting ? 'Envoi…' : 'Envoyer l\'invitation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm retrait */}
      {confirmRetirer && (
        <ConfirmModal
          open={true}
          onOpenChange={open => { if (!open) setConfirmRetirer(null) }}
          onConfirm={retirer}
          loading={retirant}
          title="Retirer l'accès"
          confirmLabel="Retirer"
          message={`Êtes-vous sûr de vouloir retirer l'accès de ${confirmRetirer.full_name} à cette mutuelle ? Il ne pourra plus se connecter au tableau de bord.`}
        />
      )}
    </Card>
  )
}

// ── Section C : Configuration paiements ──────────────────────────────────────

function PaiementsSection({ mutuelle, onUpdate }: { mutuelle: Mutuelle; onUpdate: (m: Mutuelle) => void }) {
  const cfg = (mutuelle.paiement_config ?? {}) as Record<string, unknown>
  const [numWave, setNumWave] = useState((cfg.numero_wave as string) ?? '')
  const [numOm, setNumOm] = useState((cfg.numero_om as string) ?? '')
  const [rib, setRib] = useState((cfg.rib as string) ?? '')
  const [autoWave, setAutoWave] = useState((cfg.auto_wave as boolean) ?? false)
  const [delaiCible, setDelaiCible] = useState((cfg.delai_cible_jours as number) ?? 3)
  const [modeDefaut, setModeDefaut] = useState((cfg.mode_defaut as string) ?? 'wave')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const paiement_config = { numero_wave: numWave.trim(), numero_om: numOm.trim(), rib: rib.trim(), auto_wave: autoWave, delai_cible_jours: delaiCible, mode_defaut: modeDefaut }
    const { data, error } = await supabase.functions.invoke('update-mutuelle-infos', { body: { paiement_config } })
    setSaving(false)
    if (error) { toast.error('Erreur enregistrement'); return }
    onUpdate({ ...mutuelle, paiement_config })
    toast.success('Config paiements enregistrée')
  }

  return (
    <Card title="Configuration paiements">
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            ⚠️ Les clés API Wave/OM sont stockées dans les secrets d'Edge Functions et ne sont jamais visibles en base de données.
            Configurez-les dans le tableau de bord Supabase → Edge Function Secrets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Numéro Wave Money">
            <input type="text" value={numWave} onChange={e => setNumWave(e.target.value)} placeholder="+221 77 XXX XX XX" className={inputCls} />
          </Field>
          <Field label="Numéro Orange Money">
            <input type="text" value={numOm} onChange={e => setNumOm(e.target.value)} placeholder="+221 77 XXX XX XX" className={inputCls} />
          </Field>
          <Field label="RIB / Coordonnées bancaires" className="sm:col-span-2">
            <input type="text" value={rib} onChange={e => setRib(e.target.value)} placeholder="SN XXX XXXX..." className={inputCls} />
          </Field>
          <Field label="Mode de remboursement par défaut">
            <select value={modeDefaut} onChange={e => setModeDefaut(e.target.value)} className={inputCls}>
              <option value="wave">Wave Money</option>
              <option value="orange_money">Orange Money</option>
              <option value="virement">Virement bancaire</option>
              <option value="especes">Espèces</option>
            </select>
          </Field>
          <Field label="Délai cible remboursement (jours ouvrés)">
            <input type="number" min={1} max={30} value={delaiCible} onChange={e => setDelaiCible(Number(e.target.value))} className={inputCls} />
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={autoWave} onChange={e => setAutoWave(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Activer remboursements Wave automatiques</p>
            <p className="text-xs text-gray-400">Les remboursements approuvés seront initiés automatiquement via Wave API</p>
          </div>
        </label>
      </div>

      <div className="flex justify-end mt-6">
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </div>
    </Card>
  )
}

// ── Section D : Règles métier ─────────────────────────────────────────────────

function ReglesSection({ mutuelle, onUpdate }: { mutuelle: Mutuelle; onUpdate: (m: Mutuelle) => void }) {
  const rm = (mutuelle.regles_metier ?? {}) as Record<string, unknown>
  const tp = (mutuelle.tp_rules ?? {}) as Record<string, unknown>
  const [carenceDays, setCarenceDays] = useState((rm.carence_jours as number) ?? 30)
  const [slaHeures, setSlaHeures] = useState((rm.sla_heures as number) ?? 72)
  const [suspensionJ, setSuspensionJ] = useState((rm.suspension_cotisation_jours as number) ?? 60)
  const [plafondTpAuto, setPlafondTpAuto] = useState((tp.seuil_confirmation_montant as number) ?? 50000)
  const [retardSeuil, setRetardSeuil] = useState((tp.seuil_jours_retard as number) ?? 30)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const regles_metier = { carence_jours: carenceDays, sla_heures: slaHeures, suspension_cotisation_jours: suspensionJ }
    const tp_rules = { ...tp, seuil_confirmation_montant: plafondTpAuto, seuil_jours_retard: retardSeuil }
    const { data, error } = await supabase.functions.invoke('update-mutuelle-infos', { body: { regles_metier, tp_rules } })
    setSaving(false)
    if (error) { toast.error('Erreur enregistrement'); return }
    onUpdate({ ...mutuelle, regles_metier, tp_rules })
    toast.success('Règles métier enregistrées')
  }

  return (
    <Card title="Règles métier">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Remboursements</p>
          <div className="space-y-3">
            <Field label="Délai de carence (jours)">
              <input type="number" min={0} max={365} value={carenceDays} onChange={e => setCarenceDays(Number(e.target.value))} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Délai avant prise en charge après adhésion</p>
            </Field>
            <Field label="SLA traitement demande (heures)">
              <input type="number" min={1} max={720} value={slaHeures} onChange={e => setSlaHeures(Number(e.target.value))} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Alerte si dépassé (défaut : 72h)</p>
            </Field>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Cotisations & Suspension</p>
          <div className="space-y-3">
            <Field label="Suspension automatique après (jours)">
              <input type="number" min={1} max={365} value={suspensionJ} onChange={e => setSuspensionJ(Number(e.target.value))} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Jours de retard avant suspension auto</p>
            </Field>
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Tiers Payant</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Plafond TP sans validation (FCFA)">
              <input type="number" min={0} value={plafondTpAuto} onChange={e => setPlafondTpAuto(Number(e.target.value))} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">En dessous : validation automatique</p>
            </Field>
            <Field label="Retard cotisation bloquant TP (jours)">
              <input type="number" min={0} value={retardSeuil} onChange={e => setRetardSeuil(Number(e.target.value))} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Si retard > ce seuil : TP bloqué</p>
            </Field>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </div>
    </Card>
  )
}

// ── Section E : Intégrations ──────────────────────────────────────────────────

function IntegrationsSection() {
  return (
    <Card title="Intégrations">
      <div className="space-y-4">
        <IntegCard
          icon="🌊"
          name="Wave Money"
          description="Paiements et remboursements mobiles"
          status="configured"
          detail="Configuré via Edge Function Secrets (WAVE_API_KEY). Non visible en base."
          docsUrl="https://developer.wave.com"
        />
        <IntegCard
          icon="🟠"
          name="Orange Money"
          description="Paiements mobiles Orange"
          status="configured"
          detail="Configuré via Edge Function Secrets (OM_API_KEY). Non visible en base."
          docsUrl="https://developer.orange.com/apis/om-webpay-sn"
        />
        <IntegCard
          icon="🔥"
          name="Firebase Cloud Messaging"
          description="Notifications push temps réel"
          status="active"
          detail="Actif — les notifications push utilisent FCM v1 via service account."
        />
      </div>
    </Card>
  )
}

function IntegCard({ icon, name, description, status, detail, docsUrl }: {
  icon: string; name: string; description: string; status: 'active' | 'configured' | 'inactive'
  detail: string; docsUrl?: string
}) {
  const statusColors = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    configured: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  }
  const statusLabels = { active: 'Actif', configured: 'Configuré', inactive: 'Non configuré' }
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
      <span className="text-3xl">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status]}`}>{statusLabels[status]}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        <p className="text-xs text-gray-400 mt-1 italic">{detail}</p>
        {docsUrl && (
          <a href={docsUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline mt-1 inline-block">
            Documentation →
          </a>
        )}
      </div>
    </div>
  )
}

// ── Section F : Danger zone ───────────────────────────────────────────────────

function DangerSection({ mutuelleId }: { mutuelleId: string }) {
  const [exporting, setExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteConfirm2, setShowDeleteConfirm2] = useState(false)
  const [showDeleteConfirm3, setShowDeleteConfirm3] = useState(false)
  const [raisonDeletion, setRaisonDeletion] = useState('')
  const [sending, setSending] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    const { data, error } = await supabase.functions.invoke('export-mutuelle-data', { body: {} })
    setExporting(false)
    if (error) { toast.error('Erreur export'); return }

    const fichiers = data.data?.fichiers ?? data.fichiers ?? {}
    let count = 0
    for (const [filename, content] of Object.entries(fichiers)) {
      const blob = new Blob([content as string], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      count++
      await new Promise(r => setTimeout(r, 300))
    }
    toast.success(`${count} fichier(s) CSV exporté(s)`)
  }

  const handleDelete = async () => {
    setSending(true)
    const { error } = await supabase.functions.invoke('request-mutuelle-deletion', {
      body: { raison: raisonDeletion.trim() },
    })
    setSending(false)
    if (error) { toast.error('Erreur envoi demande'); return }
    toast.success('Demande de résiliation envoyée à l\'équipe Sene Werr')
    setShowDeleteConfirm3(false)
    setRaisonDeletion('')
  }

  return (
    <Card title="Zone de danger">
      <div className="space-y-4">
        {/* Export */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">Exporter toutes les données</p>
              <p className="text-xs text-gray-400 mt-1">
                Télécharge 4 fichiers CSV : adhérents, cotisations, remboursements, tiers payant.
                Aucune donnée médicale (ordonnances, CR) n'est incluse.
              </p>
            </div>
            <Button variant="secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Export…' : '↓ Exporter'}
            </Button>
          </div>
        </div>

        {/* Résiliation */}
        <div className="border border-red-200 dark:border-red-800 rounded-xl p-4 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-red-700 dark:text-red-400 text-sm">Demander la résiliation du compte mutuelle</p>
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                Cette action envoie une demande à l'équipe Sene Werr. Aucune suppression immédiate.
                Vous serez contacté sous 48h ouvrées.
              </p>
            </div>
            <Button variant="primary" onClick={() => setShowDeleteConfirm(true)}>
              Demander résiliation
            </Button>
          </div>
        </div>
      </div>

      {/* Triple confirmation */}
      <ConfirmModal
        open={showDeleteConfirm}
        onOpenChange={open => { if (!open) setShowDeleteConfirm(false) }}
        onConfirm={() => { setShowDeleteConfirm(false); setShowDeleteConfirm2(true) }}
        title="Confirmer la demande de résiliation"
        confirmLabel="Continuer"
        message="Vous êtes sur le point de demander la résiliation du compte mutuelle sur Sene Werr. Cette action est irréversible à terme. Êtes-vous sûr ?"
      />

      <ConfirmModal
        open={showDeleteConfirm2}
        onOpenChange={open => { if (!open) setShowDeleteConfirm2(false) }}
        onConfirm={() => { setShowDeleteConfirm2(false); setShowDeleteConfirm3(true) }}
        title="Deuxième confirmation"
        confirmLabel="Oui, je confirme"
        message="Toutes les données (adhérents, cotisations, remboursements) seront archivées puis supprimées selon les conditions contractuelles. Confirmez-vous ?"
      />

      <Modal open={showDeleteConfirm3} onOpenChange={setShowDeleteConfirm3} title="Raison de la résiliation" size="sm">
        <div className="p-4 space-y-4">
          <Field label="Raison (optionnel)">
            <textarea
              value={raisonDeletion}
              onChange={e => setRaisonDeletion(e.target.value)}
              rows={3}
              placeholder="Pourquoi souhaitez-vous résilier votre compte ?"
              className={inputCls}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm3(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleDelete} disabled={sending}>
              {sending ? 'Envoi…' : 'Envoyer la demande'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
