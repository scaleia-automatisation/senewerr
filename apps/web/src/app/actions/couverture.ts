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

  // Récupérer l'id patient
  const { data: patientRow } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!patientRow) return { error: 'Profil patient introuvable.' }

  const patientId = (patientRow as unknown as { id: string }).id

  // Trouver ou créer l'organisme
  let orgId: string

  const { data: existingOrg } = await supabase
    .from('organismes_couverture')
    .select('id')
    .ilike('name', input.orgName)
    .eq('org_type', input.orgType)
    .maybeSingle()

  if (existingOrg) {
    orgId = (existingOrg as unknown as { id: string }).id
  } else {
    const { data: newOrg, error: orgErr } = await supabase
      .from('organismes_couverture')
      .insert({
        name: input.orgName,
        org_type: input.orgType,
        // Créé par auto-déclaration patient — pas encore vérifié
      })
      .select('id')
      .single()

    if (orgErr || !newOrg) return { error: 'Impossible d\'enregistrer l\'organisme.' }
    orgId = (newOrg as unknown as { id: string }).id
  }

  // Vérifier si une adhérence active existe déjà pour cet organisme
  const { data: existing } = await supabase
    .from('adherents_couverture')
    .select('id')
    .eq('patient_id', patientId)
    .eq('coverage_org_id', orgId)
    .eq('is_active', true)
    .maybeSingle()

  if (existing) return { error: 'Vous êtes déjà déclaré(e) comme adhérent de cet organisme.' }

  // Insérer l'adhérence
  const { error: insertErr } = await supabase
    .from('adherents_couverture')
    .insert({
      coverage_org_id: orgId,
      patient_id: patientId,
      member_number: input.memberNumber,
      employer_name: input.employerName,
      start_date: input.startDate,
      end_date: input.endDate,
      is_active: true,
    })

  if (insertErr) return { error: insertErr.message }

  return {}
}
