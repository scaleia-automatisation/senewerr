import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pill, Share2, Sparkles, ShoppingBag, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusPill } from '@/components/ui/StatusPill'
import { Banner } from '@/components/ui/Banner'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

interface PrescriptionItem {
  id: string
  medicine_name: string
  dosage: string
  form: string
  quantity: number
  frequency: string
  duration_days: number
  instructions?: string
  renewal_allowed: boolean
}

interface Prescription {
  id: string
  prescription_number: string
  status: string
  issued_at: string
  signed_at: string
  valid_until: string
  qr_token: string
  prescription_items: PrescriptionItem[]
  professionals: { profiles: { first_name: string; last_name: string } } | null
}

export default function PrescriptionPage() {
  const { prescriptionId } = useParams<{ prescriptionId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [pharmacySearch, setPharmacySearch] = useState('')
  const [pharmacies, setPharmacies] = useState<{ id: string; name: string; city: string }[]>([])
  const [sharing, setSharing] = useState<string | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)

  useEffect(() => { fetchPrescription() }, [prescriptionId])

  async function fetchPrescription() {
    if (!prescriptionId) return
    const { data, error: err } = await supabase
      .from('prescriptions')
      .select('*, prescription_items(*), professionals(profiles(first_name, last_name))')
      .eq('id', prescriptionId)
      .single()

    if (err || !data) { setError('Ordonnance introuvable.'); setLoading(false); return }
    setPrescription(data as unknown as Prescription)
    setLoading(false)
  }

  async function searchPharmacies() {
    if (!pharmacySearch.trim()) return
    const { data } = await supabase
      .from('establishments')
      .select('id, organizations(name, city)')
      .eq('establishment_type', 'pharmacy')
      .ilike('organizations.name', `%${pharmacySearch}%`)
      .limit(8)
    setPharmacies((data ?? []).map((e: { id: string; organizations: { name: string; city: string } | null }) => ({
      id: e.id,
      name: e.organizations?.name ?? 'Pharmacie',
      city: e.organizations?.city ?? '',
    })))
  }

  async function sharePrescription(pharmacyId: string) {
    setSharing(pharmacyId)
    const { error: err } = await supabase.functions.invoke('share-prescription', {
      body: { prescriptionId, pharmacyId },
    })
    setSharing(null)
    if (!err) { setShowShareModal(false); fetchPrescription() }
  }

  async function explainPrescription() {
    setExplaining(true)
    const { data } = await supabase.functions.invoke('ai-explain-document', {
      body: { prescriptionId },
    })
    setExplaining(false)
    if (data?.explanation) setExplanation(data.explanation)
  }

  const isExpired = prescription?.valid_until && new Date(prescription.valid_until) < new Date()
  const proName = prescription?.professionals
    ? `Dr ${prescription.professionals.profiles.first_name} ${prescription.professionals.profiles.last_name}`
    : '—'

  if (loading) return <div className="flex flex-col gap-s-4 p-s-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-md" />)}</div>
  if (error || !prescription) return <div className="p-s-4"><Banner kind="warning">{error ?? 'Erreur.'}</Banner></div>

  return (
    <div className="flex flex-col gap-s-4 p-s-4 max-w-xl mx-auto">
      {isExpired && <Banner kind="warning">Cette ordonnance a expiré le {new Date(prescription.valid_until).toLocaleDateString('fr-FR')}.</Banner>}

      <Card className="p-s-4">
        <div className="flex items-start justify-between gap-s-2">
          <div>
            <p className="font-display font-semibold text-ink">{prescription.prescription_number ?? 'Ordonnance'}</p>
            <p className="text-small text-ink-2 mt-s-1">{proName}</p>
            {prescription.signed_at && (
              <p className="text-small text-ink-3">Signée le {new Date(prescription.signed_at).toLocaleDateString('fr-FR')}</p>
            )}
          </div>
          <StatusPill status={prescription.status} label={prescription.status} />
        </div>
        {prescription.valid_until && (
          <p className="mt-s-2 text-small text-ink-3">
            Valide jusqu'au <strong className="text-ink">{new Date(prescription.valid_until).toLocaleDateString('fr-FR')}</strong>
          </p>
        )}
        {prescription.qr_token && (
          <a
            href={`/verifier/${prescription.qr_token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-s-3 flex items-center gap-s-1 text-small text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Vérifier l'authenticité
          </a>
        )}
      </Card>

      <div className="rounded-md border border-line overflow-hidden">
        <table className="w-full text-small">
          <thead className="bg-surface-2">
            <tr>
              <th className="px-s-3 py-s-2 text-left font-medium text-ink-2">Médicament</th>
              <th className="px-s-3 py-s-2 text-left font-medium text-ink-2">Dosage</th>
              <th className="px-s-3 py-s-2 text-right font-medium text-ink-2">Qté</th>
            </tr>
          </thead>
          <tbody>
            {prescription.prescription_items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-surface' : 'bg-surface-2'}>
                <td className="px-s-3 py-s-2 text-ink">
                  <p className="font-medium">{item.medicine_name}</p>
                  {item.frequency && <p className="text-ink-3">{item.frequency} · {item.duration_days}j</p>}
                </td>
                <td className="px-s-3 py-s-2 text-ink-2">{item.dosage} {item.form}</td>
                <td className="px-s-3 py-s-2 text-right text-ink">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-s-2">
        <Button variant="secondary" onClick={() => navigate(`/patient/medicaments?ordonnance=${prescriptionId}`)}>
          <ShoppingBag className="w-4 h-4 mr-s-1" />
          Trouver en pharmacie
        </Button>
        {!isExpired && (
          <Button variant="secondary" onClick={() => setShowShareModal(true)}>
            <Share2 className="w-4 h-4 mr-s-1" />
            Partager
          </Button>
        )}
        <Button variant="ghost" loading={explaining} onClick={explainPrescription}>
          <Sparkles className="w-4 h-4 mr-s-1" />
          Explication IA
        </Button>
      </div>

      {explanation && (
        <Card className="p-s-4 bg-surface-2">
          <p className="text-small font-medium text-accent mb-s-2">Explication simplifiée</p>
          <p className="text-small text-ink whitespace-pre-wrap">{explanation}</p>
          <p className="mt-s-2 text-small text-ink-3 italic">Aide à la compréhension — consultez votre médecin pour tout avis médical.</p>
        </Card>
      )}

      <Modal open={showShareModal} onClose={() => setShowShareModal(false)} title="Partager avec une pharmacie">
        <div className="flex flex-col gap-s-3">
          <div className="flex gap-s-2">
            <Input label="" placeholder="Nom de la pharmacie…" value={pharmacySearch} onChange={e => setPharmacySearch(e.target.value)} />
            <Button onClick={searchPharmacies} className="shrink-0">Chercher</Button>
          </div>
          {pharmacies.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-line p-s-3">
              <div>
                <p className="text-small font-medium text-ink">{p.name}</p>
                <p className="text-small text-ink-3">{p.city}</p>
              </div>
              <Button loading={sharing === p.id} onClick={() => sharePrescription(p.id)}>Partager</Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
