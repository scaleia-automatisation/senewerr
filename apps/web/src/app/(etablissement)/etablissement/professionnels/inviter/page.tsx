'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Search, UserPlus, Loader2, CheckCircle2 } from 'lucide-react'

interface FoundPro {
  profileId: string
  proId: string
  fullName: string
  proType: string
  phone: string | null
}

export default function InviterProfessionnelPage() {
  const router  = useRouter()
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<FoundPro[]>([])
  const [searching, setSearching] = useState(false)
  const [invited,  setInvited]  = useState<Set<string>>(new Set())
  const [loading,  setLoading]  = useState<string | null>(null)
  const [error,    setError]    = useState('')
  const [noResult, setNoResult] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true); setNoResult(false); setResults([])
    const supabase = createClient()

    // Recherche par téléphone ou nom
    const phone = query.replace(/\s/g, '')
    const isPhone = /^\+?[0-9]{7,}$/.test(phone)

    const { data: prosData } = await (supabase
      .from('professionals')
      .select('id, professional_type, specialty, title, profiles!inner(id, first_name, last_name, phone)') as unknown as Promise<{ data: unknown[] | null }>)

    const pros = (prosData ?? []) as unknown as {
      id: string
      professional_type: string | null
      specialty: string | null
      title: string | null
      profiles: { id: string; first_name: string; last_name: string; phone: string | null } | null
    }[]

    const matched = pros.filter(p => {
      const pr = p.profiles
      if (!pr) return false
      if (isPhone) return pr.phone?.replace(/\s/g, '').includes(phone.replace('+221', ''))
      const name = `${pr.first_name} ${pr.last_name}`.toLowerCase()
      return name.includes(query.toLowerCase())
    })

    const found: FoundPro[] = matched.map(p => ({
      profileId: p.profiles!.id,
      proId: p.id,
      fullName: `${p.title ? p.title + ' ' : ''}${p.profiles!.first_name} ${p.profiles!.last_name}`.trim(),
      proType: p.specialty?.replace(/_/g, ' ') ?? p.professional_type?.replace(/_/g, ' ') ?? '',
      phone: p.profiles!.phone,
    }))

    setResults(found)
    setNoResult(found.length === 0)
    setSearching(false)
  }

  async function handleInvite(pro: FoundPro) {
    setLoading(pro.proId); setError('')
    const supabase = createClient()

    // Récupérer l'ID de l'établissement depuis la session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: estData } = await supabase.from('establishments').select('id').eq('profile_id', user.id).maybeSingle()
    const est = estData as unknown as { id: string } | null
    if (!est) { setError('Établissement introuvable.'); setLoading(null); return }

    // Vérifier que la relation n'existe pas déjà
    const { data: existing } = await supabase.from('establishment_professionals').select('id, status')
      .eq('establishment_id', est.id).eq('professional_id', pro.proId).maybeSingle()
    const ex = existing as unknown as { id: string; status: string } | null

    if (ex) {
      if (ex.status === 'accepted') { setError(`${pro.fullName} est déjà membre de votre établissement.`); setLoading(null); return }
      if (ex.status === 'pending')  { setError(`Une invitation est déjà en attente pour ${pro.fullName}.`); setLoading(null); return }
    }

    const { error: err } = await (supabase.from('establishment_professionals') as unknown as {
      insert: (v: unknown) => Promise<{ error: { message: string } | null }>
    }).insert({
      establishment_id: est.id,
      professional_id: pro.proId,
      status: 'pending',
    })

    if (err) { setError(err.message); setLoading(null); return }

    // Notification au professionnel
    await (supabase.from('notifications') as unknown as {
      insert: (v: unknown) => Promise<{ error: unknown }>
    }).insert({
      recipient_id: pro.profileId,
      type: 'establishment_invite',
      title: 'Invitation d\'un établissement',
      body: 'Un établissement vous invite à rejoindre son équipe.',
      is_read: false,
    })

    setInvited(prev => new Set(prev).add(pro.proId))
    setLoading(null)
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-5">
      <Link href="/etablissement/professionnels" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
        <ArrowLeft className="w-4 h-4" />
        Professionnels
      </Link>

      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Inviter un professionnel</h1>
        <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
          Recherchez par nom ou numéro de téléphone. Le professionnel recevra une notification.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="sw-input flex-1"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Nom, prénom ou +221 7X XXX XX XX"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center gap-1.5"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Chercher
        </button>
      </form>

      {error && (
        <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)] rounded-lg px-3 py-2">{error}</p>
      )}

      {noResult && (
        <div className="sw-card p-6 text-center">
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun professionnel trouvé pour « {query} ».</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-1">
            Le professionnel doit être inscrit sur Séné Wérr avant de pouvoir être invité.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--sw-ink-3)]">{results.length} résultat{results.length !== 1 ? 's' : ''}</p>
          {results.map(pro => (
            <div key={pro.proId} className="sw-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[var(--sw-primary)]">
                  {pro.fullName.split(' ').filter(w => /^[A-Za-zÀ-ÿ]/.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--sw-ink)] truncate">{pro.fullName}</p>
                <p className="text-xs text-[var(--sw-ink-2)] truncate">{pro.proType}{pro.phone ? ` · ${pro.phone}` : ''}</p>
              </div>
              {invited.has(pro.proId) ? (
                <span className="flex items-center gap-1 text-xs font-medium text-[var(--sw-success)] shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> Invité
                </span>
              ) : (
                <button
                  onClick={() => handleInvite(pro)}
                  disabled={loading === pro.proId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--sw-primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-60 transition-opacity shrink-0"
                >
                  {loading === pro.proId
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <><UserPlus className="w-3.5 h-3.5" /> Inviter</>
                  }
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
