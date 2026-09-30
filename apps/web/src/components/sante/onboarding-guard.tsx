'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function OnboardingGuard({ hasProfile }: { hasProfile: boolean }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!hasProfile && !pathname.startsWith('/sante/onboarding')) {
      router.replace('/sante/onboarding')
    }
  }, [hasProfile, pathname, router])

  return null
}
