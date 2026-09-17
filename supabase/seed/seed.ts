// supabase/seed/seed.ts — Medikool test accounts + demo data
// Deno: deno run --allow-env --allow-net seed.ts
// Requires: SUPABASE_SERVICE_ROLE_KEY env var

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://oosgigliuhztuktkqdgn.supabase.co'
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY requis')
if (Deno.env.get('APP_ENV') === 'production') throw new Error('🚫 Seed refusé en production')

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function pause(ms = 600) {
  return new Promise(r => setTimeout(r, ms))
}

async function createUser(
  email: string,
  firstName: string,
  lastName: string,
  role: string,
): Promise<string | null> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: '00000000',
    email_confirm: true,
    user_metadata: { is_test_account: true, first_name: firstName, last_name: lastName, role },
  })
  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      const { data: list } = await db.auth.admin.listUsers({ perPage: 500 })
      const existing = list?.users.find((u) => u.email === email)
      if (existing) {
        console.log(`  ↺ ${email} (existant id=${existing.id.slice(0,8)})`)
        return existing.id
      }
    }
    console.error(`  ✗ ${email}: ${error.message}`)
    return null
  }
  console.log(`  ✓ ${email} → ${data.user?.id?.slice(0,8)}`)
  return data.user?.id ?? null
}

async function getProfile(userId: string): Promise<{ id: string } | null> {
  await pause()
  const { data } = await (db as any).from('profiles').select('id').eq('user_id', userId).maybeSingle()
  if (!data) {
    // Retry once
    await pause(1000)
    const { data: data2 } = await (db as any).from('profiles').select('id').eq('user_id', userId).maybeSingle()
    return data2
  }
  return data
}

async function updateProfile(profileId: string, updates: Record<string, unknown>) {
  const { error } = await (db as any).from('profiles').update(updates).eq('id', profileId)
  if (error) console.error(`    ✗ profile update ${profileId.slice(0,8)}: ${error.message}`)
}

async function upsertOrg(fields: {
  name: string; type: string; city?: string; verification_status?: string
}): Promise<string | null> {
  const slug = slugify(fields.name)
  const { data, error } = await (db as any)
    .from('organizations')
    .upsert(
      { slug, name: fields.name, type: fields.type, city: fields.city, verification_status: fields.verification_status ?? 'pending' },
      { onConflict: 'slug' }
    )
    .select('id')
    .single()
  if (error) { console.error(`    ✗ org ${fields.name}: ${error.message}`); return null }
  return data?.id ?? null
}

async function upsertEstablishment(orgId: string, estType: string) {
  const { error } = await (db as any).from('establishments').upsert(
    { organization_id: orgId, establishment_type: estType },
    { onConflict: 'organization_id' }
  )
  if (error) console.error(`    ✗ establishment: ${error.message}`)
}

async function upsertPharmacy(orgId: string, license: string) {
  const { error } = await (db as any).from('pharmacies').upsert(
    { organization_id: orgId, license_number: license, accepts_insurance: true },
    { onConflict: 'organization_id' }
  )
  if (error) console.error(`    ✗ pharmacy: ${error.message}`)
}

async function upsertInsuranceProvider(orgId: string) {
  const { error } = await (db as any).from('insurance_providers').upsert(
    { organization_id: orgId, payment_model: 'tiers_payant' },
    { onConflict: 'organization_id' }
  )
  if (error) console.error(`    ✗ insurance_provider: ${error.message}`)
}

async function addOrgMember(orgId: string, profileId: string, role: string) {
  const { error } = await (db as any).from('organization_members').upsert(
    { organization_id: orgId, profile_id: profileId, role, status: 'active', joined_at: new Date().toISOString() },
    { onConflict: 'organization_id,profile_id' }
  )
  if (error) console.error(`    ✗ org_member: ${error.message}`)
}

async function upsertProfessional(profileId: string, proType: string, specialty: string, verif: string) {
  const { error } = await (db as any).from('professionals').upsert(
    { profile_id: profileId, professional_type: proType, specialty, verification_status: verif },
    { onConflict: 'profile_id' }
  )
  if (error) console.error(`    ✗ professional: ${error.message}`)
}

async function upsertPatient(profileId: string) {
  const { error } = await (db as any).from('patients').upsert(
    { profile_id: profileId },
    { onConflict: 'profile_id' }
  )
  if (error) console.error(`    ✗ patient: ${error.message}`)
}

async function addSubscription(
  type: 'profile' | 'organization',
  id: string,
  planId: string,
) {
  // Check for existing active subscription
  const col = type === 'profile' ? 'profile_id' : 'organization_id'
  const { data: existing } = await (db as any)
    .from('subscriptions').select('id').eq(col, id)
    .in('status', ['active', 'trialing', 'past_due']).maybeSingle()
  if (existing) { console.log(`    ↺ subscription existante`); return }

  const payload: Record<string, unknown> = {
    subscriber_type: type, plan_id: planId,
    billing_interval: 'monthly', status: 'active',
    current_period_start: new Date().toISOString(),
  }
  payload[col] = id

  const { error } = await (db as any).from('subscriptions').insert(payload)
  if (error) console.error(`    ✗ subscription: ${error.message}`)
  else console.log(`    + subscription plan OK`)
}

// ──────────────────────────────────────────────────────────────────────────────
// LOAD PLAN MAP
// ──────────────────────────────────────────────────────────────────────────────

async function loadPlans(): Promise<Record<string, string>> {
  const { data, error } = await (db as any).from('subscription_plans').select('id, code')
  if (error) { console.error('✗ Impossible de charger les plans:', error.message); return {} }
  const map: Record<string, string> = {}
  for (const p of data ?? []) map[p.code] = p.id
  console.log(`  Plans chargés: ${Object.keys(map).length} codes`)
  return map
}

// ──────────────────────────────────────────────────────────────────────────────
// FIND ORG ID BY NAME (for staff/member seeding)
// ──────────────────────────────────────────────────────────────────────────────

async function findOrg(name: string): Promise<string | null> {
  const { data } = await (db as any).from('organizations').select('id').eq('name', name).maybeSingle()
  return data?.id ?? null
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60))
  console.log('MEDIKOOL SEED — Bloc 8 Test Accounts')
  console.log('='.repeat(60))

  const plans = await loadPlans()
  const P = (code: string) => plans[code] ?? plans['patient_free'] ?? Object.values(plans)[0]

  // ────────────────────────────────────────────────────────────
  // COMPTES PRINCIPAUX (10)
  // ────────────────────────────────────────────────────────────
  console.log('\n── 1. Moussa Dembélé (super_admin) ──')
  {
    const uid = await createUser('mousssdembel@gmail.com', 'Moussa', 'Dembélé', 'super_admin')
    if (uid) {
      const p = await getProfile(uid)
      if (p) await updateProfile(p.id, { role: 'super_admin', city: 'Dakar' })
    }
  }

  console.log('\n── 2. Scale IA Support (platform_admin) ──')
  {
    const uid = await createUser('contacts.scale.ia@gmail.com', 'Scale', 'IA Support', 'platform_admin')
    if (uid) {
      const p = await getProfile(uid)
      if (p) await updateProfile(p.id, { role: 'platform_admin' })
    }
  }

  console.log('\n── 3. Mamadou Diop (patient) ──')
  {
    const uid = await createUser('tropicaddictverdun@gmail.com', 'Mamadou', 'Diop', 'patient')
    if (uid) {
      const p = await getProfile(uid)
      if (p) {
        await updateProfile(p.id, { date_of_birth: '1985-03-15', gender: 'm', city: 'Dakar' })
        await upsertPatient(p.id)
        await addSubscription('profile', p.id, P('patient_free'))
      }
    }
  }

  console.log('\n── 4. Dr Aminata Ndiaye (professionnel, cardiologie) ──')
  let orgNdiayeId: string | null = null
  {
    const uid = await createUser('contact.scale.ia@gmail.com', 'Aminata', 'Ndiaye', 'professional')
    if (uid) {
      const p = await getProfile(uid)
      if (p) {
        await updateProfile(p.id, { role: 'professional', city: 'Dakar' })
        await upsertProfessional(p.id, 'medecin_specialiste', 'cardiologie', 'verified')
        await addSubscription('profile', p.id, P('pro_pro'))
        orgNdiayeId = await upsertOrg({ name: 'Cabinet Ndiaye', type: 'establishment', city: 'Dakar', verification_status: 'verified' })
        if (orgNdiayeId) {
          await upsertEstablishment(orgNdiayeId, 'cabinet')
          await addOrgMember(orgNdiayeId, p.id, 'owner')
        }
      }
    }
  }

  console.log('\n── 5. Dr Ibrahima Ba (professionnel, médecine générale) ──')
  {
    const uid = await createUser('lifemindsetsucess@gmail.com', 'Ibrahima', 'Ba', 'professional')
    if (uid) {
      const p = await getProfile(uid)
      if (p) {
        await updateProfile(p.id, { role: 'professional', city: 'Dakar' })
        await upsertProfessional(p.id, 'medecin_generaliste', 'médecine générale', 'verified')
        await addSubscription('profile', p.id, P('pro_free'))
      }
    }
  }

  console.log('\n── 6. Clinique Kër Santé (establishment_admin) ──')
  let orgKerSanteId: string | null = null
  {
    const uid = await createUser('cestcarrelamarque@gmail.com', 'Admin', 'Kër Santé', 'establishment_admin')
    if (uid) {
      const p = await getProfile(uid)
      if (p) {
        await updateProfile(p.id, { role: 'establishment_admin', city: 'Dakar' })
        orgKerSanteId = await upsertOrg({ name: 'Clinique Kër Santé', type: 'establishment', city: 'Dakar', verification_status: 'verified' })
        if (orgKerSanteId) {
          await upsertEstablishment(orgKerSanteId, 'clinique')
          await addOrgMember(orgKerSanteId, p.id, 'owner')
          await addSubscription('organization', orgKerSanteId, P('est_centre'))
        }
      }
    }
  }

  console.log('\n── 7. Rokhaya Sène (establishment_staff, Clinique Kër Santé) ──')
  {
    const uid = await createUser('ebookproai@gmail.com', 'Rokhaya', 'Sène', 'establishment_staff')
    if (uid) {
      const p = await getProfile(uid)
      if (p) {
        await updateProfile(p.id, { role: 'establishment_staff', city: 'Dakar' })
        if (orgKerSanteId) await addOrgMember(orgKerSanteId, p.id, 'staff')
      }
    }
  }

  console.log('\n── 8. Pharmacie Liberté (pharmacy_admin) ──')
  let orgPharmacieId: string | null = null
  {
    const uid = await createUser('pharmaciesconnectes@gmail.com', 'Admin', 'Pharmacie Liberté', 'pharmacy_admin')
    if (uid) {
      const p = await getProfile(uid)
      if (p) {
        await updateProfile(p.id, { role: 'pharmacy_admin', city: 'Dakar' })
        orgPharmacieId = await upsertOrg({ name: 'Pharmacie Liberté', type: 'pharmacy', city: 'Dakar', verification_status: 'verified' })
        if (orgPharmacieId) {
          await upsertPharmacy(orgPharmacieId, 'LIC-PH-000001')
          await addOrgMember(orgPharmacieId, p.id, 'owner')
          await addSubscription('organization', orgPharmacieId, P('pharmacy_start'))
        }
      }
    }
  }

  console.log('\n── 9. Cheikh Fall (pharmacy_staff, Pharmacie Liberté) ──')
  {
    const uid = await createUser('lemiamsrestaurant@gmail.com', 'Cheikh', 'Fall', 'pharmacy_staff')
    if (uid) {
      const p = await getProfile(uid)
      if (p) {
        await updateProfile(p.id, { role: 'pharmacy_staff', city: 'Dakar' })
        if (orgPharmacieId) await addOrgMember(orgPharmacieId, p.id, 'staff')
      }
    }
  }

  console.log('\n── 10. Teranga Santé (mutual_admin) ──')
  {
    const uid = await createUser('elitemaagency@gmail.com', 'Admin', 'Teranga Santé', 'mutual_admin')
    if (uid) {
      const p = await getProfile(uid)
      if (p) {
        await updateProfile(p.id, { role: 'mutual_admin', city: 'Dakar' })
        const orgId = await upsertOrg({ name: 'Teranga Santé', type: 'insurance_provider', verification_status: 'verified' })
        if (orgId) {
          await upsertInsuranceProvider(orgId)
          await addOrgMember(orgId, p.id, 'owner')
          await addSubscription('organization', orgId, P('mutual_pro'))
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // COMPTES SUPPLÉMENTAIRES (8)
  // ────────────────────────────────────────────────────────────
  console.log('\n── Comptes supplémentaires ──')

  const extra: Array<{
    email: string; first: string; last: string; role: string;
    dob?: string; city?: string; gender?: string;
    proType?: string; specialty?: string; proVerif?: string; planCode?: string;
    isPatient?: boolean; isOrg?: boolean; orgName?: string; orgType?: string; orgEstType?: string;
  }> = [
    { email: 'patient1.test@medikool.test', first: 'Fatou', last: 'Sarr', role: 'patient', dob: '1990-03-12', city: 'Dakar', gender: 'f', isPatient: true, planCode: 'patient_free' },
    { email: 'patient2.test@medikool.test', first: 'Ousmane', last: 'Diallo', role: 'patient', dob: '1975-07-05', city: 'Thiès', gender: 'm', isPatient: true, planCode: 'patient_free' },
    { email: 'pro1.test@medikool.test', first: 'Mariama', last: 'Diouf', role: 'professional', proType: 'medecin_specialiste', specialty: 'pédiatrie', proVerif: 'verified', planCode: 'pro_solo' },
    { email: 'pro2.test@medikool.test', first: 'Abdoulaye', last: 'Sy', role: 'professional', proType: 'medecin_specialiste', specialty: 'dermatologie', proVerif: 'verified', planCode: 'pro_expert' },
    { email: 'pro3.test@medikool.test', first: 'Awa', last: 'Ndoye', role: 'professional', proType: 'sage_femme', specialty: 'sage-femme', proVerif: 'verified', planCode: 'pro_free' },
    { email: 'etab1.test@medikool.test', first: 'Admin', last: 'Les Almadies', role: 'establishment_admin', isOrg: true, orgName: 'Cabinet Médical Les Almadies', orgType: 'establishment', orgEstType: 'cabinet', city: 'Dakar', planCode: 'est_cabinet' },
    { email: 'etab2.test@medikool.test', first: 'Admin', last: 'Thiès Santé', role: 'establishment_admin', isOrg: true, orgName: 'Centre Médical Thiès Santé', orgType: 'establishment', orgEstType: 'centre_medical', city: 'Thiès', planCode: 'est_centre' },
    { email: 'etab3.test@medikool.test', first: 'Admin', last: 'Espoir', role: 'establishment_admin', isOrg: true, orgName: 'Clinique Saint-Louis Espoir', orgType: 'establishment', orgEstType: 'clinique', city: 'Saint-Louis', planCode: 'est_clinique' },
  ]

  for (const a of extra) {
    console.log(`  ${a.email}`)
    const uid = await createUser(a.email, a.first, a.last, a.role)
    if (!uid) continue
    const p = await getProfile(uid)
    if (!p) { console.error(`    ✗ profile not found`); continue }

    const profileUpdates: Record<string, unknown> = { role: a.role }
    if (a.dob) profileUpdates.date_of_birth = a.dob
    if (a.city) profileUpdates.city = a.city
    if (a.gender) profileUpdates.gender = a.gender
    await updateProfile(p.id, profileUpdates)

    if (a.isPatient) {
      await upsertPatient(p.id)
      if (a.planCode) await addSubscription('profile', p.id, P(a.planCode))
    }
    if (a.proType && a.specialty) {
      await upsertProfessional(p.id, a.proType, a.specialty, a.proVerif ?? 'pending')
      if (a.planCode) await addSubscription('profile', p.id, P(a.planCode))
    }
    if (a.isOrg && a.orgName && a.orgType) {
      const orgId = await upsertOrg({ name: a.orgName, type: a.orgType, city: a.city })
      if (orgId) {
        if (a.orgEstType) await upsertEstablishment(orgId, a.orgEstType)
        await addOrgMember(orgId, p.id, 'owner')
        if (a.planCode) await addSubscription('organization', orgId, P(a.planCode))
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // MÉDICAMENTS (12)
  // ────────────────────────────────────────────────────────────
  console.log('\n── Médicaments ──')
  const medicines = [
    { name: 'Doliprane', dosage: '1000mg', form: 'comprimé', generic_name: 'Paracétamol', medicine_class: 'Analgésique/Antipyrétique', prescription_required: false },
    { name: 'Amoxicilline', dosage: '500mg', form: 'gélule', generic_name: 'Amoxicilline', medicine_class: 'Antibiotique', prescription_required: true },
    { name: 'Ibuprofène', dosage: '400mg', form: 'comprimé', generic_name: 'Ibuprofène', medicine_class: 'Anti-inflammatoire', prescription_required: false },
    { name: 'Metformine', dosage: '500mg', form: 'comprimé', generic_name: 'Metformine', medicine_class: 'Antidiabétique', prescription_required: true },
    { name: 'Amlodipine', dosage: '5mg', form: 'comprimé', generic_name: 'Amlodipine', medicine_class: 'Antihypertenseur', prescription_required: true },
    { name: 'Atorvastatine', dosage: '20mg', form: 'comprimé', generic_name: 'Atorvastatine', medicine_class: 'Hypolipémiant', prescription_required: true },
    { name: 'Oméprazole', dosage: '20mg', form: 'gélule', generic_name: 'Oméprazole', medicine_class: 'Inhibiteur pompe à protons', prescription_required: false },
    { name: 'Cotrimoxazole', dosage: '480mg', form: 'comprimé', generic_name: 'Sulfaméthoxazole/Triméthoprime', medicine_class: 'Antibiotique', prescription_required: true },
    { name: 'Artemether-Lumefantrine', dosage: '20/120mg', form: 'comprimé', generic_name: 'Artéméther+Luméfantrine', medicine_class: 'Antipaludique', prescription_required: true },
    { name: 'Acide folique', dosage: '5mg', form: 'comprimé', generic_name: 'Acide folique', medicine_class: 'Supplément vitaminique', prescription_required: false },
    { name: 'Sulfate ferreux', dosage: '200mg', form: 'comprimé', generic_name: 'Fer II', medicine_class: 'Antianémique', prescription_required: false },
    { name: 'Vitamine D3', dosage: '1000UI', form: 'gouttes', generic_name: 'Cholécalciférol', medicine_class: 'Supplément vitaminique', prescription_required: false },
  ]
  for (const med of medicines) {
    const { error } = await (db as any).from('medicines').upsert(med, { onConflict: 'name,dosage,form' })
    if (error) console.error(`  ✗ ${med.name}: ${error.message}`)
    else console.log(`  + ${med.name} ${med.dosage}`)
  }

  // ────────────────────────────────────────────────────────────
  // FAQ (12 questions)
  // ────────────────────────────────────────────────────────────
  console.log('\n── FAQ ──')
  const faqItems = [
    { question: 'Medikool est-il gratuit pour les patients ?', answer_md: 'Oui, la version Patient Gratuit permet de prendre jusqu\'à 20 rendez-vous par mois sans frais.', category: 'tarifs', display_order: 1, published: true },
    { question: 'Comment prendre un rendez-vous médical ?', answer_md: 'Recherchez un professionnel de santé, choisissez un créneau disponible et confirmez votre rendez-vous en quelques clics.', category: 'patients', display_order: 2, published: true },
    { question: 'Puis-je consulter mon ordonnance en ligne ?', answer_md: 'Oui, vos ordonnances signées électroniquement sont disponibles dans votre espace personnel et peuvent être partagées directement avec une pharmacie.', category: 'patients', display_order: 3, published: true },
    { question: 'Mes données médicales sont-elles protégées ?', answer_md: 'Toutes les données sont chiffrées et hébergées conformément aux normes internationales de protection des données de santé.', category: 'confidentialité', display_order: 4, published: true },
    { question: 'Comment ma mutuelle est-elle prise en charge ?', answer_md: 'Si votre professionnel est partenaire d\'une mutuelle enregistrée sur Medikool, la prise en charge est gérée automatiquement lors de la réservation.', category: 'mutuelle', display_order: 5, published: true },
    { question: 'Comment un professionnel s\'inscrit-il sur Medikool ?', answer_md: 'Créez votre compte professionnel, soumettez vos justificatifs (ordre, diplôme) et notre équipe valide votre profil sous 48h.', category: 'professionnels', display_order: 6, published: true },
    { question: 'Qu\'est-ce que la téléconsultation ?', answer_md: 'La téléconsultation permet une consultation médicale en vidéo sans déplacement. Disponible avec les professionnels ayant activé cette option.', category: 'patients', display_order: 7, published: true },
    { question: 'Comment fonctionne la livraison de médicaments ?', answer_md: 'Partagez votre ordonnance avec une pharmacie partenaire sur Medikool. La pharmacie prépare votre commande et vous prévient quand elle est prête.', category: 'pharmacie', display_order: 8, published: true },
    { question: 'Quels modes de paiement sont acceptés ?', answer_md: 'Nous acceptons les cartes bancaires, Wave, Orange Money et les virements bancaires.', category: 'paiements', display_order: 9, published: true },
    { question: 'Comment annuler un rendez-vous ?', answer_md: 'Vous pouvez annuler un rendez-vous jusqu\'à 2 heures avant l\'heure prévue depuis votre espace personnel.', category: 'patients', display_order: 10, published: true },
    { question: 'Comment une clinique peut-elle rejoindre Medikool ?', answer_md: 'Les établissements de santé peuvent s\'inscrire via notre offre Établissement. Un conseiller vous contactera pour configurer votre espace.', category: 'établissements', display_order: 11, published: true },
    { question: 'Medikool est-il disponible en dehors de Dakar ?', answer_md: 'Oui, Medikool couvre l\'ensemble du Sénégal. Des professionnels sont présents dans toutes les régions du pays.', category: 'général', display_order: 12, published: true },
  ]
  for (const faq of faqItems) {
    const { error } = await (db as any).from('faq_items').upsert(faq, { onConflict: 'question' }).catch(() => ({ error: { message: 'no unique on question' } }))
    if (error && !error.message.includes('no unique')) {
      // faq_items has no unique on question, try insert with ignoreDuplicates
      const { error: err2 } = await (db as any).from('faq_items').insert(faq)
      if (err2 && !err2.message.includes('duplicate')) console.error(`  ✗ FAQ: ${err2.message}`)
    }
    else console.log(`  + FAQ Q${faq.display_order}`)
  }

  // ────────────────────────────────────────────────────────────
  // BLOG POSTS (6 articles)
  // ────────────────────────────────────────────────────────────
  console.log('\n── Blog posts ──')
  const blogPosts = [
    { slug: 'sante-numerique-senegal', title: 'La santé numérique au Sénégal : enjeux et opportunités', excerpt: 'Comment le digital transforme l\'accès aux soins en Afrique de l\'Ouest.', author_name: 'Équipe médicale Medikool', status: 'published', published_at: '2026-01-15T09:00:00Z', content_md: 'Le Sénégal connaît une transformation numérique rapide dans le secteur de la santé. Des applications mobiles aux plateformes de télémédecine, les innovations se multiplient pour améliorer l\'accès aux soins.' },
    { slug: 'prise-en-charge-mutuelle', title: 'Comment fonctionne la prise en charge mutuelle avec Medikool', excerpt: 'Guide pratique pour utiliser votre mutuelle santé lors de vos consultations.', author_name: 'Équipe médicale Medikool', status: 'published', published_at: '2026-02-01T09:00:00Z', content_md: 'Medikool simplifie la prise en charge par votre mutuelle. Lors de la réservation, votre carte mutuelle est vérifiée automatiquement et la portion à votre charge est calculée en temps réel.' },
    { slug: 'teleconsultation-guide', title: 'Téléconsultation : tout ce que vous devez savoir', excerpt: 'Consultez un médecin depuis chez vous en toute sécurité.', author_name: 'Équipe médicale Medikool', status: 'published', published_at: '2026-02-20T09:00:00Z', content_md: 'La téléconsultation permet de consulter un professionnel de santé par vidéo depuis n\'importe où. Pratique pour les zones éloignées ou les situations non urgentes.' },
    { slug: 'pharmacies-partenaires', title: 'Vos médicaments disponibles en quelques clics avec Medikool', excerpt: 'Partagez votre ordonnance directement avec une pharmacie partenaire.', author_name: 'Équipe médicale Medikool', status: 'published', published_at: '2026-03-05T09:00:00Z', content_md: 'Grâce à Medikool, partagez votre ordonnance électronique avec une pharmacie partenaire. La pharmacie prépare votre commande et vous avertit quand elle est prête à être retirée.' },
    { slug: 'dossier-medical-numerique', title: 'Votre dossier médical numérique sur Medikool', excerpt: 'Centralisez et sécurisez votre historique de santé en un seul endroit.', author_name: 'Équipe médicale Medikool', status: 'published', published_at: '2026-03-20T09:00:00Z', content_md: 'Medikool vous offre un espace sécurisé pour stocker vos ordonnances, résultats d\'analyses, comptes rendus et antécédents médicaux. Partagez-les avec vos médecins en toute confiance.' },
    { slug: 'professionnels-sante-rejoignez', title: 'Professionnels de santé : rejoignez la communauté Medikool', excerpt: 'Gérez votre agenda, vos patients et vos consultations depuis une seule plateforme.', author_name: 'Équipe médicale Medikool', status: 'published', published_at: '2026-04-01T09:00:00Z', content_md: 'Medikool offre aux professionnels de santé des outils puissants : gestion d\'agenda, téléconsultation, ordonnances électroniques, et suivi des paiements. Rejoignez des centaines de praticiens déjà inscrits.' },
  ]
  for (const post of blogPosts) {
    const { error } = await (db as any).from('blog_posts').upsert(post, { onConflict: 'slug' })
    if (error) console.error(`  ✗ blog ${post.slug}: ${error.message}`)
    else console.log(`  + ${post.slug}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('SEED TERMINÉ')
  console.log('='.repeat(60))
  console.log(`
Résumé:
  - 10 comptes principaux (motsde passe: 00000000)
  - 8 comptes supplémentaires (mot de passe: 00000000)
  - 12 médicaments
  - 12 questions FAQ
  - 6 articles blog
`)
}

main().catch(err => {
  console.error('ERREUR FATALE:', err)
  Deno.exit(1)
})
