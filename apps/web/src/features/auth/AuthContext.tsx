import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@medikool/shared'

type Profile = Database['public']['Tables']['profiles']['Row']

export interface AuthCtx {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  /** Nécessite une vérification 2FA (aal1 mais facteurs inscrits) */
  needsMfa: boolean
  signOut: () => Promise<void>
  signOutAll: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsMfa, setNeedsMfa] = useState(false)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    setProfile(data ?? null)
  }, [])

  const checkMfa = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!data) return
    // needsMfa = a des facteurs mais aal courant < requis
    const hasFactors = (data.currentLevel === 'aal1') && data.nextLevel === 'aal2'
    setNeedsMfa(hasFactors)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        await Promise.all([fetchProfile(session.user.id), checkMfa()])
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session) {
          await Promise.all([fetchProfile(session.user.id), checkMfa()])
        } else {
          setProfile(null)
          setNeedsMfa(false)
        }
        setLoading(false)
      },
    )
    return () => subscription.unsubscribe()
  }, [fetchProfile, checkMfa])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const signOutAll = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'global' })
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await fetchProfile(session.user.id)
  }, [session, fetchProfile])

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, profile, loading, needsMfa, signOut, signOutAll, refreshProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuthContext(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
