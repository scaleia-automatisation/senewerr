'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Patient } from '@/types'

export function usePatient() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      setPatient(data)
      setLoading(false)
    }

    load()
  }, [])

  return { patient, loading }
}
