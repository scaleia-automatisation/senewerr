import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  type: string
  titre: string
  message: string
  urgence: 'info' | 'warning' | 'error' | 'success'
  lu: boolean
  created_at: string
  data?: Record<string, unknown>
}

interface NotifPrefs {
  [type: string]: boolean | undefined
  silence_heures?: { debut: number; fin: number }
}

// ── Config des 15 types de notifications ─────────────────────────────────────

const NOTIF_TYPES: { id: string; label: string; icon: string; urgent?: boolean }[] = [
  { id: 'nouvelle_demande_remboursement', label: 'Nouvelle demande remboursement', icon: '📋' },
  { id: 'demande_tp', label: 'Demande tiers payant', icon: '🏥' },
  { id: 'cotisation_recue', label: 'Cotisation reçue', icon: '✅' },
  { id: 'cotisation_retard', label: 'Cotisation en retard', icon: '⚠️' },
  { id: 'contrat_expirant', label: 'Contrat expirant', icon: '📅' },
  { id: 'adherent_suspendu', label: 'Adhérent suspendu', icon: '🚫' },
  { id: 'convention_praticien_acceptee', label: 'Convention praticien acceptée', icon: '🤝' },
  { id: 'convention_pharmacie_acceptee', label: 'Convention pharmacie acceptée', icon: '💊' },
  { id: 'resiliation_adherent', label: 'Résiliation adhérent', icon: '❌' },
  { id: 'sla_depasse', label: 'SLA dépassé (>72h)', icon: '🔴', urgent: true },
  { id: 'document_requis', label: 'Document requis', icon: '📎' },
  { id: 'message_admin', label: 'Message admin Sene Werr', icon: '📢' },
  { id: 'alerte_tresorerie', label: 'Alerte trésorerie', icon: '💸', urgent: true },
  { id: 'rapport_mensuel', label: 'Rapport mensuel généré', icon: '📊' },
  { id: 'erreur_paiement', label: 'Erreur de paiement', icon: '🔴', urgent: true },
]

const TYPE_MAP = Object.fromEntries(NOTIF_TYPES.map(t => [t.id, t]))

const URGENCE_COLORS: Record<string, string> = {
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
}

// Deep links par type de notification
function getDeepLink(notif: Notification): string {
  const d = notif.data ?? {}
  const type = notif.type
  if (type === 'nouvelle_demande_remboursement' && d.demande_id) return `/mutuelle/demandes?id=${d.demande_id}`
  if (type === 'sla_depasse' && d.demande_id) return `/mutuelle/demandes?id=${d.demande_id}`
  if (type === 'demande_tp') return '/mutuelle/tiers-payant'
  if (type === 'cotisation_recue' || type === 'cotisation_retard') return '/mutuelle/cotisations'
  if (type === 'contrat_expirant' && d.contrat_id) return `/mutuelle/adherents?contrat=${d.contrat_id}`
  if (type === 'adherent_suspendu' && d.adherent_id) return `/mutuelle/adherents/${d.adherent_id}`
  if (type === 'convention_praticien_acceptee' || type === 'convention_pharmacie_acceptee') return '/mutuelle/tiers-payant?tab=historique'
  if (type === 'resiliation_adherent') return '/mutuelle/adherents'
  if (type === 'alerte_tresorerie') return '/mutuelle/paiements?tab=tresorerie'
  if (type === 'rapport_mensuel') return '/mutuelle/documents'
  if (type === 'erreur_paiement') return '/mutuelle/paiements'
  if (type === 'document_requis' && d.demande_id) return `/mutuelle/demandes?id=${d.demande_id}`
  return '/mutuelle'
}

const PAGE_SIZE = 20

// ── Main component ────────────────────────────────────────────────────────────

export default function MutuelleNotificationsPage() {
  const navigate = useNavigate()

  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const [filterType, setFilterType] = useState<string>('tous')
  const [filterLu, setFilterLu] = useState<'tous' | 'lu' | 'non_lu'>('tous')

  const [showPrefs, setShowPrefs] = useState(false)
  const [prefs, setPrefs] = useState<NotifPrefs>({})
  const [silenceDebut, setSilenceDebut] = useState(22)
  const [silenceFin, setSilenceFin] = useState(7)
  const [silenceActive, setSilenceActive] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const profileIdRef = useRef<string | null>(null)

  // Charger le profileId
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      ;(supabase as any).from('profiles').select('id').eq('user_id', user.id).single()
        .then(({ data }: any) => {
          profileIdRef.current = data?.id ?? null
        })
    })
  }, [])

  const loadNotifs = useCallback(async (reset = true) => {
    const newOffset = reset ? 0 : offset
    if (reset) setLoading(true); else setLoadingMore(true)

    let query = (supabase as any)
      .from('notifications')
      .select('id, type, titre, message, urgence, lu, created_at, data')
      .order('created_at', { ascending: false })
      .range(newOffset, newOffset + PAGE_SIZE - 1)

    // Filtrage type
    if (filterType !== 'tous') query = query.eq('type', filterType)
    if (filterLu === 'lu') query = query.eq('lu', true)
    if (filterLu === 'non_lu') query = query.eq('lu', false)

    const { data, error } = await query
    if (error) { toast.error('Erreur chargement notifications'); setLoading(false); setLoadingMore(false); return }

    const list: Notification[] = data ?? []
    setHasMore(list.length === PAGE_SIZE)
    if (reset) { setNotifs(list); setOffset(PAGE_SIZE) }
    else { setNotifs(prev => [...prev, ...list]); setOffset(newOffset + PAGE_SIZE) }

    setLoading(false); setLoadingMore(false)
  }, [filterType, filterLu, offset])

  useEffect(() => { loadNotifs(true) }, [filterType, filterLu]) // eslint-disable-line

  // Charger les préférences
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await (supabase as any).from('notification_preferences')
        .select('preferences').eq('user_id', user.id).maybeSingle()
      const p: NotifPrefs = (data as any)?.preferences ?? {}
      setPrefs(p)
      if (p.silence_heures) {
        setSilenceActive(true)
        setSilenceDebut(p.silence_heures.debut)
        setSilenceFin(p.silence_heures.fin)
      }
    }
    load()
  }, [])

  // Realtime
  useEffect(() => {
    const ch = (supabase as any).channel('notifs-gest')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        loadNotifs(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, []) // eslint-disable-line

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await (supabase as any).from('notifications').update({ lu: true })
      .eq('lu', false)
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
    toast.success('Toutes les notifications marquées comme lues')
  }

  const markRead = async (id: string) => {
    await (supabase as any).from('notifications').update({ lu: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  const handleClick = async (notif: Notification) => {
    if (!notif.lu) await markRead(notif.id)
    navigate(getDeepLink(notif))
  }

  const savePrefs = async () => {
    setSavingPrefs(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingPrefs(false); return }

    const newPrefs: NotifPrefs = { ...prefs }
    if (silenceActive) newPrefs.silence_heures = { debut: silenceDebut, fin: silenceFin }
    else delete newPrefs.silence_heures

    await (supabase as any).from('notification_preferences').upsert({
      user_id: user.id,
      preferences: newPrefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setPrefs(newPrefs)
    toast.success('Préférences enregistrées')
    setSavingPrefs(false)
  }

  const nbNonLus = notifs.filter(n => !n.lu).length

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h1>
            {nbNonLus > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{nbNonLus}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowPrefs(p => !p)}>
              ⚙️ Préférences
            </Button>
            <Button variant="ghost" onClick={markAllRead} disabled={nbNonLus === 0}>
              Tout marquer lu
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex gap-1">
            {(['tous', 'non_lu', 'lu'] as const).map(v => (
              <button key={v} onClick={() => setFilterLu(v)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                  filterLu === v ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>
                {v === 'tous' ? 'Tous' : v === 'non_lu' ? 'Non lus' : 'Lus'}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterType('tous')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                filterType === 'tous' ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              Tous types
            </button>
            {NOTIF_TYPES.map(t => (
              <button key={t.id} onClick={() => setFilterType(t.id)}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                  filterType === t.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Panneau préférences ── */}
      <AnimatePresence>
        {showPrefs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Préférences de notification</h2>

              {/* Toggles par type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NOTIF_TYPES.map(t => (
                  <label key={t.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      {t.icon} {t.label}
                      {t.urgent && <span className="text-xs text-red-500 font-medium">(urgence)</span>}
                    </span>
                    <input
                      type="checkbox"
                      checked={prefs[t.id] !== false}
                      onChange={e => setPrefs(p => ({ ...p, [t.id]: e.target.checked }))}
                      disabled={t.urgent}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </label>
                ))}
              </div>

              {/* Plages de silence */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input type="checkbox" id="silence" checked={silenceActive} onChange={e => setSilenceActive(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  <label htmlFor="silence" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Plage de silence (aucun push sauf urgences)
                  </label>
                </div>
                {silenceActive && (
                  <div className="flex items-center gap-4 ml-7">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">De</label>
                      <select value={silenceDebut} onChange={e => setSilenceDebut(Number(e.target.value))}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}h</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">À</label>
                      <select value={silenceFin} onChange={e => setSilenceFin(Number(e.target.value))}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}h</option>)}
                      </select>
                    </div>
                    <span className="text-xs text-gray-400">UTC — sauf urgences (SLA, trésorerie, erreur paiement)</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="primary" onClick={savePrefs} disabled={savingPrefs}>
                  {savingPrefs ? 'Enregistrement…' : 'Enregistrer les préférences'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Liste notifications ── */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-full" />
              </div>
            </div>
          ))
        ) : notifs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Aucune notification</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {notifs.map(notif => {
              const tConfig = TYPE_MAP[notif.type]
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => handleClick(notif)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm group ${
                    notif.lu
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : URGENCE_COLORS[notif.urgence] ?? URGENCE_COLORS.info
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">{tConfig?.icon ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`text-sm font-semibold ${notif.lu ? 'text-gray-700 dark:text-gray-200' : 'text-gray-900 dark:text-white'}`}>
                          {notif.titre}
                          {!notif.lu && <span className="ml-2 w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                        </p>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{notif.message}</p>
                      <p className="text-xs text-blue-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Cliquer pour voir →
                      </p>
                    </div>
                    {!notif.lu && (
                      <button
                        onClick={e => { e.stopPropagation(); markRead(notif.id) }}
                        className="flex-shrink-0 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                        title="Marquer comme lu"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}

        {/* Pagination infinie */}
        {hasMore && (
          <div className="text-center py-2">
            <Button variant="ghost" onClick={() => loadNotifs(false)} disabled={loadingMore}>
              {loadingMore ? 'Chargement…' : 'Charger plus'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
