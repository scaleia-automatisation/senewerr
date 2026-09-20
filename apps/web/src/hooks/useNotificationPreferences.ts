import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/features/auth/AuthContext'

export type NotifPrefs = Record<string, boolean>

export function useNotificationPreferences() {
  const { session } = useAuthContext()
  const [prefs, setPrefs] = useState<NotifPrefs>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase
      .from('notification_preferences' as any)
      .select('preferences')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPrefs((data as any)?.preferences ?? {})
        setLoading(false)
      })
  }, [session])

  async function toggle(key: string) {
    if (!session) return
    const next = { ...prefs, [key]: !(prefs[key] ?? true) }
    setPrefs(next)
    setSaving(true)
    await supabase
      .from('notification_preferences' as any)
      .upsert(
        { user_id: session.user.id, preferences: next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    setSaving(false)
  }

  function isEnabled(key: string) {
    return prefs[key] !== false
  }

  return { prefs, loading, saving, toggle, isEnabled }
}
