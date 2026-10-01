import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ReservationFlow } from '@/components/patient/reservation-flow'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Réserver un médicament' }

export default async function ReserverPage({ searchParams }: { searchParams: Promise<{ productId?: string; pharmacyId?: string; prescriptionId?: string }> }) {
  const { productId, pharmacyId, prescriptionId } = await searchParams
  if (!productId || !pharmacyId) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  const [prodRes, pharmRes, stockRes, prescsRes] = await Promise.all([
    supabase
      .from('produits_pharmacie')
      .select('id, name, dosage, prescription_required, unit_price_fcfa')
      .eq('id', productId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle(),
    supabase
      .from('pharmacies')
      .select('id, name, address_commune, address_region, phone, profile_id')
      .eq('id', pharmacyId)
      .maybeSingle(),
    supabase
      .from('stock_pharmacie')
      .select('id, quantity_available')
      .eq('product_id', productId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle(),
    supabase
      .from('ordonnances')
      .select('id, status, created_at')
      .eq('patient_id', patient.id)
      .in('status', ['issued', 'shared'])
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const product = prodRes.data as unknown as {
    id: string; name: string; dosage: string | null
    prescription_required: boolean; unit_price_fcfa: number
  } | null
  const pharmacy = pharmRes.data as unknown as {
    id: string; name: string; address_commune: string | null
    address_region: string | null; phone: string | null; profile_id: string
  } | null
  const stock = stockRes.data as unknown as { id: string; quantity_available: number | null } | null
  const prescriptions = (prescsRes.data ?? []) as unknown as { id: string; status: string; created_at: string }[]

  if (!product || !pharmacy) notFound()

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto">
      <ReservationFlow
        patientId={patient.id}
        product={product}
        pharmacy={pharmacy}
        stock={stock}
        prescriptions={prescriptions}
        preselectedPrescriptionId={prescriptionId ?? null}
      />
    </div>
  )
}
