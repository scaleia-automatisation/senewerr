import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PaymentForm } from '@/components/patient/payment-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payer mon reste à charge' }

export default async function PayerPage({ searchParams }: { searchParams: Promise<{ reservationId?: string }> }) {
  const { reservationId } = await searchParams
  if (!reservationId) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  // Fetch reservation + related data
  const [resaRes, covRes, payRes] = await Promise.all([
    supabase.from('pharmacy_reservations')
      .select('id, status, quantity, pickup_code, pharmacy_reservation_items(medication_name, pharmacy_products(dosage)), pharmacies(id, name)')
      .eq('id', reservationId)
      .eq('patient_id', patient.id)
      .maybeSingle(),
    supabase.from('coverage_requests')
      .select('id, status, amount_total, amount_covered, amount_patient')
      .eq('reservation_id', reservationId)
      .in('status', ['approved', 'partial'])
      .maybeSingle(),
    supabase.from('payments')
      .select('id, status, amount_fcfa, method, reference_code, confirmed_at')
      .eq('reservation_id', reservationId)
      .eq('payment_type', 'patient_charge')
      .maybeSingle(),
  ])

  const resa = resaRes.data as unknown as {
    id: string; status: string; quantity: number | null; pickup_code: string | null
    pharmacy_reservation_items: { medication_name: string; pharmacy_products?: { dosage?: string | null } | null }[]
    pharmacies: { id: string; name: string } | null
  } | null
  if (!resa) notFound()

  const cov = covRes.data as unknown as {
    id: string; status: string; amount_total: number | null; amount_covered: number | null; amount_patient: number | null
  } | null
  const existingPayment = payRes.data as unknown as {
    id: string; status: string; amount_fcfa: number; method: string | null; reference_code: string | null; confirmed_at: string | null
  } | null

  const firstItem = (resa.pharmacy_reservation_items as { medication_name: string; pharmacy_products?: { dosage?: string | null } | null }[] | undefined)?.[0]
  const ph = resa.pharmacies as unknown as { id: string; name: string } | null

  // Determine amount to pay
  const amountToPay = cov?.amount_patient ?? null
  if (amountToPay !== null && amountToPay <= 0 && !existingPayment) {
    // No payment needed
    redirect(`/patient/pharmacie/reservations/${reservationId}`)
  }

  return (
    <div className="p-4 lg:p-6 max-w-sm mx-auto">
      <PaymentForm
        patientId={patient.id}
        reservationId={reservationId}
        coverageRequestId={cov?.id ?? null}
        medicationName={firstItem ? `${firstItem.medication_name}${firstItem.pharmacy_products?.dosage ? ` ${firstItem.pharmacy_products.dosage}` : ''}` : 'Médicament'}
        pharmacyName={ph?.name ?? 'Pharmacie'}
        pharmacyId={ph?.id ?? ''}
        amountFcfa={amountToPay ?? (cov?.amount_total ?? 0)}
        totalAmount={cov?.amount_total ?? null}
        coveredAmount={cov?.amount_covered ?? null}
        pickupCode={resa.pickup_code ? `MED-${resa.pickup_code}` : null}
        existingPayment={existingPayment}
      />
    </div>
  )
}
