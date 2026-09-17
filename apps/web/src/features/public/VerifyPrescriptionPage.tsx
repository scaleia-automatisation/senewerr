import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, XCircle, Shield } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Banner } from '@/components/ui/Banner'
import { supabase } from '@/lib/supabase'

interface PrescriptionInfo {
  prescription_number: string
  issued_at: string
  valid_until: string
  status: string
  professional_name: string
  patient_name: string
  items: { medicine_name: string; dosage: string; quantity: number }[]
}

export default function VerifyPrescriptionPage() {
  const { qrToken } = useParams<{ qrToken: string }>()
  const [info, setInfo] = useState<PrescriptionInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired'>('loading')

  useEffect(() => {
    if (qrToken) verify()
  }, [qrToken])

  async function verify() {
    const { data, error } = await supabase
      .from('prescriptions')
      .select(`
        prescription_number, issued_at, valid_until, status, qr_token,
        prescription_items(medicine_name, dosage, quantity),
        professionals(profiles(first_name, last_name)),
        patients(profiles(first_name, last_name))
      `)
      .eq('qr_token', qrToken)
      .single()

    if (error || !data) { setStatus('invalid'); return }

    const today = new Date()
    const validUntil = data.valid_until ? new Date(data.valid_until) : null
    if (validUntil && validUntil < today) { setStatus('expired'); return }
    if (!['signed','available_patient','shared_pharmacy','validated_pharmacy'].includes(data.status)) {
      setStatus('invalid'); return
    }

    const pro = data.professionals as { profiles: { first_name: string; last_name: string } } | null
    const patient = data.patients as { profiles: { first_name: string; last_name: string } } | null

    setInfo({
      prescription_number: data.prescription_number,
      issued_at: data.issued_at,
      valid_until: data.valid_until,
      status: data.status,
      professional_name: pro ? `Dr ${pro.profiles.first_name} ${pro.profiles.last_name}` : 'Professionnel',
      patient_name: patient ? `${patient.profiles.first_name} ${patient.profiles.last_name}` : 'Patient',
      items: data.prescription_items ?? [],
    })
    setStatus('valid')
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-s-4 p-s-4">
        <XCircle className="h-16 w-16 text-status-danger" />
        <h1 className="text-h2 font-display text-ink">Ordonnance invalide</h1>
        <Banner kind="warning">Ce QR code ne correspond à aucune ordonnance valide sur MediKool.</Banner>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-s-4 p-s-4">
        <XCircle className="h-16 w-16 text-status-warning" />
        <h1 className="text-h2 font-display text-ink">Ordonnance expirée</h1>
        <Banner kind="warning">Cette ordonnance a dépassé sa date de validité.</Banner>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-s-4 pt-16">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-s-3 mb-s-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-status-success/10">
            <CheckCircle className="h-10 w-10 text-status-success" />
          </div>
          <h1 className="text-h2 font-display text-ink">Ordonnance authentique</h1>
          <div className="flex items-center gap-s-1 text-small text-ink-3">
            <Shield className="w-3 h-3" />
            <span>Vérifiée par MediKool</span>
          </div>
        </div>

        <div className="rounded-lg border border-line p-s-4 flex flex-col gap-s-3">
          <div className="flex justify-between">
            <span className="text-small text-ink-3">Numéro</span>
            <span className="text-small font-medium text-ink">{info?.prescription_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-small text-ink-3">Prescripteur</span>
            <span className="text-small font-medium text-ink">{info?.professional_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-small text-ink-3">Patient</span>
            <span className="text-small font-medium text-ink">{info?.patient_name}</span>
          </div>
          {info?.valid_until && (
            <div className="flex justify-between">
              <span className="text-small text-ink-3">Valide jusqu'au</span>
              <span className="text-small font-medium text-ink">
                {new Date(info.valid_until).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}
        </div>

        <div className="mt-s-4 rounded-lg border border-line p-s-4">
          <p className="text-small font-medium text-ink mb-s-3">Médicaments prescrits</p>
          <div className="flex flex-col gap-s-2">
            {info?.items.map((item, i) => (
              <div key={i} className="flex justify-between text-small">
                <span className="text-ink">{item.medicine_name} — {item.dosage}</span>
                <span className="text-ink-3">× {item.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-s-4 text-center text-small text-ink-3">
          Ordonnance électronique sécurisée • MediKool
        </p>
      </div>
    </div>
  )
}
