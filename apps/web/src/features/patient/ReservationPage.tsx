import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ShoppingBag, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Banner } from '@/components/ui/Banner'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

interface Product { id: string; productName: string; price: number; availableQty: number; quantity: number }
interface InsuranceMember { id: string; planName: string; coverageEnd: string }

export default function ReservationPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const pharmacyId = params.get('pharmacie') ?? ''
  const prescriptionId = params.get('ordonnance') ?? undefined
  const rawItems = params.get('items') ?? ''

  const [step, setStep] = useState(1)
  const [products, setProducts] = useState<Product[]>([])
  const [pharmacy, setPharmacy] = useState<{ name: string; city: string } | null>(null)
  const [insurance, setInsurance] = useState<InsuranceMember | null>(null)
  const [useInsurance, setUseInsurance] = useState(false)
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ reservationNumber: string; reservationCode: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { init() }, [pharmacyId])

  async function init() {
    const productIds = rawItems.split(',').filter(Boolean)
    const [pharmaRes, productsRes, insuranceRes] = await Promise.all([
      supabase.from('establishments').select('organizations(name, city)').eq('id', pharmacyId).single(),
      productIds.length
        ? supabase.from('pharmacy_products').select('id, product_name, price, available_quantity, reserved_quantity').in('id', productIds)
        : Promise.resolve({ data: [] }),
      profile?.id
        ? supabase.from('insurance_members').select('id, plan_name, coverage_end').eq('profile_id', profile.id).eq('status', 'active').maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (pharmaRes.data?.organizations) {
      const org = pharmaRes.data.organizations as { name: string; city: string }
      setPharmacy({ name: org.name, city: org.city })
    }

    setProducts((productsRes.data ?? []).map((p: { id: string; product_name: string; price: number; available_quantity: number; reserved_quantity: number }) => ({
      id: p.id,
      productName: p.product_name,
      price: p.price,
      availableQty: p.available_quantity - p.reserved_quantity,
      quantity: 1,
    })))

    if (insuranceRes.data) {
      setInsurance({
        id: insuranceRes.data.id,
        planName: insuranceRes.data.plan_name ?? 'Mutuelle',
        coverageEnd: insuranceRes.data.coverage_end,
      })
    }

    setLoading(false)
  }

  function updateQty(id: string, qty: number) {
    setProducts(ps => ps.map(p => p.id === id ? { ...p, quantity: Math.max(1, qty) } : p))
  }

  const subtotal = products.reduce((sum, p) => sum + p.price * p.quantity, 0)

  async function submit() {
    if (!consent) return
    setSubmitting(true)
    setError(null)
    const { data, error: err } = await supabase.functions.invoke('create-reservation', {
      body: {
        pharmacyId,
        items: products.map(p => ({ productId: p.id, quantity: p.quantity })),
        prescriptionId: prescriptionId || undefined,
        insuranceMemberId: useInsurance && insurance ? insurance.id : undefined,
        consentText: 'J\'autorise la préparation de cette commande par la pharmacie sélectionnée.',
      },
    })
    setSubmitting(false)
    if (err || !data?.reservationNumber) {
      const code = data?.code
      if (code === 'STOCK_INSUFFICIENT') setError(`Stock insuffisant : ${data.detail}`)
      else if (code === 'PRESCRIPTION_REQUIRED') setError('Un médicament nécessite une ordonnance.')
      else if (code === 'PHARMACY_CLOSED_FOR_RESERVATIONS') setError('Cette pharmacie n\'accepte pas les réservations en ligne.')
      else setError('Erreur lors de la réservation. Réessayez.')
      return
    }
    setResult({ reservationNumber: data.reservationNumber, reservationCode: data.reservationCode })
  }

  if (loading) return <div className="flex justify-center p-s-6"><Spinner size="lg" /></div>

  if (result) return (
    <div className="flex flex-col items-center gap-s-5 p-s-4 max-w-md mx-auto pt-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-status-success/10">
        <Check className="w-10 h-10 text-status-success" />
      </div>
      <h1 className="text-h2 font-display text-ink text-center">Réservation confirmée !</h1>
      <Card className="w-full p-s-4 text-center">
        <p className="text-small text-ink-3">Numéro de réservation</p>
        <p className="text-h2 font-display font-bold text-primary mt-s-1">{result.reservationNumber}</p>
        <p className="text-small text-ink-2 mt-s-3">La pharmacie vous contactera pour confirmer. Votre code de retrait vous sera communiqué une fois la commande prête.</p>
      </Card>
      <Button fullWidth onClick={() => navigate('/patient/pharmacie')}>Voir mes réservations</Button>
      <Button variant="secondary" fullWidth onClick={() => navigate('/patient')}>Retour à l'accueil</Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-s-4 p-s-4 max-w-md mx-auto">
      {/* Step indicator */}
      <div className="flex gap-s-1">
        {[1,2,3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-pill transition-colors ${s <= step ? 'bg-primary' : 'bg-surface-2'}`} />
        ))}
      </div>

      {step === 1 && (
        <>
          <h2 className="text-h3 font-display text-ink">Votre commande</h2>
          {pharmacy && <p className="text-small text-ink-2">{pharmacy.name} · {pharmacy.city}</p>}
          {error && <Banner kind="warning">{error}</Banner>}
          {products.map(p => (
            <Card key={p.id} className="p-s-3 flex items-center gap-s-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 shrink-0">
                <ShoppingBag className="w-5 h-5 text-ink-3" />
              </div>
              <div className="flex-1">
                <p className="text-small font-medium text-ink">{p.productName}</p>
                <p className="text-small text-ink-3">{p.price.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className="flex items-center gap-s-2">
                <button onClick={() => updateQty(p.id, p.quantity - 1)} className="w-7 h-7 rounded border border-line flex items-center justify-center text-ink hover:bg-surface-2">−</button>
                <span className="w-8 text-center text-small font-medium text-ink">{p.quantity}</span>
                <button onClick={() => updateQty(p.id, p.quantity + 1)} disabled={p.quantity >= p.availableQty} className="w-7 h-7 rounded border border-line flex items-center justify-center text-ink hover:bg-surface-2 disabled:opacity-40">+</button>
              </div>
            </Card>
          ))}
          <div className="flex justify-between text-small font-semibold text-ink border-t border-line pt-s-3">
            <span>Total</span>
            <span>{subtotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <Button fullWidth onClick={() => setStep(2)}>Continuer</Button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="text-h3 font-display text-ink">Prise en charge mutuelle</h2>
          {!insurance ? (
            <Banner kind="info">Aucune mutuelle active trouvée. Vous paierez le montant total.</Banner>
          ) : (
            <Card className="p-s-4">
              <label className="flex items-start gap-s-3 cursor-pointer">
                <input type="checkbox" checked={useInsurance} onChange={e => setUseInsurance(e.target.checked)} className="mt-1 accent-primary" />
                <div>
                  <p className="font-medium text-ink">Utiliser ma mutuelle</p>
                  <p className="text-small text-ink-2">{insurance.planName} · Valide jusqu'au {new Date(insurance.coverageEnd).toLocaleDateString('fr-FR')}</p>
                </div>
              </label>
            </Card>
          )}
          <div className="flex gap-s-2">
            <Button variant="secondary" fullWidth onClick={() => setStep(1)}>Retour</Button>
            <Button fullWidth onClick={() => setStep(3)}>Continuer</Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="text-h3 font-display text-ink">Consentement</h2>
          <Card className="p-s-4 bg-surface-2">
            <p className="text-small text-ink">
              En confirmant cette réservation, vous autorisez la pharmacie <strong>{pharmacy?.name}</strong> à préparer les médicaments listés.
              {prescriptionId && ' Votre ordonnance sera partagée avec la pharmacie pour vérification.'}
              {useInsurance && ' Votre mutuelle sera contactée pour prise en charge.'}
            </p>
          </Card>
          <label className="flex items-start gap-s-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-primary" />
            <span className="text-small text-ink">J'accepte les conditions de réservation et autorise la préparation de ma commande.</span>
          </label>
          {error && <Banner kind="warning">{error}</Banner>}
          <div className="flex gap-s-2">
            <Button variant="secondary" fullWidth onClick={() => setStep(2)}>Retour</Button>
            <Button fullWidth loading={submitting} disabled={!consent} onClick={submit}>Confirmer la réservation</Button>
          </div>
        </>
      )}
    </div>
  )
}
