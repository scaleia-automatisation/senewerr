'use server'

import { createClient } from '@/lib/supabase/server'

interface DeclarationInput {
  orgType: string
  orgName: string
  memberNumber: string | null
  employerName: string | null
  startDate: string
  endDate: string | null
}

export async function declarerCouverture(input: DeclarationInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  // Profil + patient
  const { data: profileRow } = await supabase
    .from('profils')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  const { data: patientRow } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!patientRow) return { error: 'Profil patient introuvable.' }
  const patientId = (patientRow as unknown as { id: string }).id
  const profile = profileRow as unknown as { first_name: string | null; last_name: string | null } | null
  const patientName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Un patient'
    : 'Un patient'

  // Trouver ou créer l'organisme
  let orgId: string
  let orgProfileId: string | null = null

  const { data: existingOrg } = await supabase
    .from('organismes_couverture')
    .select('id, profile_id')
    .ilike('name', input.orgName)
    .eq('org_type', input.orgType)
    .maybeSingle()

  if (existingOrg) {
    const org = existingOrg as unknown as { id: string; profile_id: string | null }
    orgId = org.id
    orgProfileId = org.profile_id
  } else {
    const { data: newOrg, error: orgErr } = await supabase
      .from('organismes_couverture')
      .insert({ name: input.orgName, org_type: input.orgType })
      .select('id, profile_id')
      .single()

    if (orgErr || !newOrg) return { error: "Impossible d'enregistrer l'organisme." }
    const org = newOrg as unknown as { id: string; profile_id: string | null }
    orgId = org.id
    orgProfileId = org.profile_id
  }

  // Doublon actif ou en attente ?
  const { data: existing } = await supabase
    .from('adherents_couverture')
    .select('id, statut')
    .eq('patient_id', patientId)
    .eq('coverage_org_id', orgId)
    .in('statut', ['en_attente', 'actif'])
    .maybeSingle()

  if (existing) {
    const s = (existing as unknown as { statut: string }).statut
    return {
      error: s === 'actif'
        ? 'Vous êtes déjà adhérent actif de cet organisme.'
        : 'Une demande est déjà en attente de validation.',
    }
  }

  // Insérer l'adhérence en attente
  const { data: newMember, error: insertErr } = await supabase
    .from('adherents_couverture')
    .insert({
      coverage_org_id: orgId,
      patient_id: patientId,
      member_number: input.memberNumber,
      employer_name: input.employerName,
      start_date: input.startDate,
      end_date: input.endDate,
      is_active: false,
      statut: 'en_attente',
    })
    .select('id')
    .single()

  if (insertErr || !newMember) return { error: insertErr?.message ?? 'Erreur insertion.' }

  // Notifier l'organisme (si un compte est lié)
  if (orgProfileId) {
    await supabase.from('notifications').insert({
      recipient_id: orgProfileId,
      notification_type: 'coverage_info_requested',
      title: 'Nouvelle demande d\'adhésion',
      body: `${patientName} déclare être adhérent de votre organisme et attend votre validation.`,
      data: {
        adherent_id: (newMember as unknown as { id: string }).id,
        patient_id: patientId,
        redirect: '/couverture/adherents',
      },
      is_read: false,
    })
  }

  return {}
}

/* ─── Validation / Refus par l'organisme ──────────────────────────────────── */

export async function validerAdherent(
  adherentId: string,
  dates?: { startDate: string; endDate: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: orgData } = await supabase
    .from('organismes_couverture')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!orgData) return { error: 'Organisme introuvable.' }
  const orgId = (orgData as unknown as { id: string }).id

  const { data: member } = await supabase
    .from('adherents_couverture')
    .select('id, patient_id, coverage_org_id')
    .eq('id', adherentId)
    .eq('coverage_org_id', orgId)
    .single()
  if (!member) return { error: 'Adhérent introuvable.' }

  const m = member as unknown as { id: string; patient_id: string; coverage_org_id: string }

  const updatePayload: Record<string, unknown> = { is_active: true, statut: 'actif' }
  if (dates?.startDate) updatePayload.start_date = dates.startDate
  if (dates?.endDate !== undefined) updatePayload.end_date = dates.endDate

  const { error } = await supabase
    .from('adherents_couverture')
    .update(updatePayload as never)
    .eq('id', adherentId)

  if (error) return { error: error.message }

  // Notifier le patient
  const { data: patientProfile } = await supabase
    .from('patients')
    .select('profile_id')
    .eq('id', m.patient_id)
    .single()

  if (patientProfile) {
    const { data: orgInfo } = await supabase
      .from('organismes_couverture')
      .select('name')
      .eq('id', orgId)
      .single()
    const orgName = (orgInfo as unknown as { name: string } | null)?.name ?? 'Votre organisme'

    await supabase.from('notifications').insert({
      recipient_id: (patientProfile as unknown as { profile_id: string }).profile_id,
      notification_type: 'coverage_validated',
      title: 'Adhésion confirmée',
      body: `${orgName} a validé votre adhésion. Votre couverture est maintenant active.`,
      data: { redirect: '/patient/couverture' },
      is_read: false,
    })
  }

  return {}
}

export async function refuserAdherent(adherentId: string, motif?: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: orgData } = await supabase
    .from('organismes_couverture')
    .select('id, name')
    .eq('profile_id', user.id)
    .single()
  if (!orgData) return { error: 'Organisme introuvable.' }
  const org = orgData as unknown as { id: string; name: string }

  const { data: member } = await supabase
    .from('adherents_couverture')
    .select('id, patient_id')
    .eq('id', adherentId)
    .eq('coverage_org_id', org.id)
    .single()
  if (!member) return { error: 'Adhérent introuvable.' }

  const m = member as unknown as { id: string; patient_id: string }

  const { error } = await supabase
    .from('adherents_couverture')
    .update({ is_active: false, statut: 'refuse', motif_refus: motif ?? null } as never)
    .eq('id', adherentId)

  if (error) return { error: error.message }

  // Notifier le patient
  const { data: patientProfile } = await supabase
    .from('patients')
    .select('profile_id')
    .eq('id', m.patient_id)
    .single()

  if (patientProfile) {
    await supabase.from('notifications').insert({
      recipient_id: (patientProfile as unknown as { profile_id: string }).profile_id,
      notification_type: 'coverage_refused',
      title: 'Adhésion non confirmée',
      body: motif
        ? `${org.name} n'a pas pu confirmer votre adhésion : ${motif}`
        : `${org.name} n'a pas pu confirmer votre adhésion. Contactez votre organisme pour plus d'informations.`,
      data: { redirect: '/patient/couverture' },
      is_read: false,
    })
  }

  return {}
}

/* ─── Renvoi après refus ───────────────────────────────────────────────────── */

interface RenvoyerInput {
  memberNumber: string | null
  employerName: string | null
  startDate: string
  endDate: string | null
}

export async function renvoyerDeclaration(
  adherentId: string,
  input: RenvoyerInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: patientRow } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!patientRow) return { error: 'Profil patient introuvable.' }
  const patientId = (patientRow as unknown as { id: string }).id

  const { data: member } = await supabase
    .from('adherents_couverture')
    .select('id, statut, coverage_org_id')
    .eq('id', adherentId)
    .eq('patient_id', patientId)
    .single()
  if (!member) return { error: 'Déclaration introuvable.' }
  const m = member as unknown as { id: string; statut: string; coverage_org_id: string }
  if (m.statut !== 'refuse') return { error: 'Seules les déclarations refusées peuvent être renvoyées.' }

  const { error: updErr } = await supabase
    .from('adherents_couverture')
    .update({
      statut: 'en_attente',
      is_active: false,
      motif_refus: null,
      member_number: input.memberNumber,
      employer_name: input.employerName,
      start_date: input.startDate,
      end_date: input.endDate,
    } as never)
    .eq('id', adherentId)
  if (updErr) return { error: updErr.message }

  const { data: orgData } = await supabase
    .from('organismes_couverture')
    .select('name, profile_id')
    .eq('id', m.coverage_org_id)
    .single()
  const org2 = orgData as unknown as { name: string; profile_id: string | null } | null

  if (org2?.profile_id) {
    const { data: profileRow } = await supabase
      .from('profils')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()
    const profile = profileRow as unknown as { first_name: string | null; last_name: string | null } | null
    const patientName = profile
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Un patient'
      : 'Un patient'

    await supabase.from('notifications').insert({
      recipient_id: org2.profile_id,
      notification_type: 'coverage_info_requested',
      title: "Déclaration d'adhésion modifiée",
      body: `${patientName} a mis à jour sa déclaration et attend votre validation.`,
      data: { adherent_id: adherentId, patient_id: patientId, redirect: '/couverture/adherents' },
      is_read: false,
    } as never)
  }

  return {}
}
