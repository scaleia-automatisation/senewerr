import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, MapPin, Video, Languages, GraduationCap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

interface ProfessionalData {
  id: string
  specialty_ids: string[]
  teleconsultation_enabled: boolean
  languages: string[]
  consultation_fee: number
  profiles: { first_name: string; last_name: string; avatar_url?: string }
  professional_qualifications: Array<{ id: string; degree: string; institution?: string; year?: number }>
  establishments: Array<{
    id: string
    organizations: { name: string; city: string; address?: string; is_verified?: boolean }
  }>
}

const SPECIALTY_LABELS: Record<string, string> = {
  general: 'Médecine générale', cardiology: 'Cardiologie', pediatrics: 'Pédiatrie',
  dermatology: 'Dermatologie', gynecology: 'Gynécologie', ophthalmology: 'Ophtalmologie',
  psychiatry: 'Psychiatrie', neurology: 'Neurologie',
}

function Initials({ name, size = 72 }: { name: string; size?: number }) {
  const parts = name.trim().split(' ')
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (
    <div
      className="rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {letters.toUpperCase()}
    </div>
  )
}

export default function ProfessionalProfilePage() {
  const { professionalId } = useParams<{ professionalId: string }>()
  const navigate = useNavigate()
  const { user, patientId } = useAuth() as { user: any; patientId?: string }

  const [pro, setPro] = useState<ProfessionalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFav, setIsFav] = useState(false)
  const [favLoading, setFavLoading] = useState(false)

  useEffect(() => {
    if (!professionalId) return
    setLoading(true)
    supabase
      .from('professionals')
      .select('*, profiles(first_name, last_name, avatar_url), professional_qualifications(*), establishments(id, organizations(name, city, address, is_verified))')
      .eq('id', professionalId)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setPro(data as ProfessionalData)
        setLoading(false)
      })
  }, [professionalId])

  useEffect(() => {
    if (!user || !professionalId || !patientId) return
    supabase
      .from('favorites')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('patient_id', patientId)
      .maybeSingle()
      .then(({ data }) => setIsFav(!!data))
  }, [user, professionalId, patientId])

  async function toggleFav() {
    if (!patientId || !professionalId || favLoading) return
    setFavLoading(true)
    if (isFav) {
      await supabase.from('favorites').delete().eq('professional_id', professionalId).eq('patient_id', patientId)
      setIsFav(false)
    } else {
      await supabase.from('favorites').insert({ professional_id: professionalId, patient_id: patientId })
      setIsFav(true)
    }
    setFavLoading(false)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-s-5 flex flex-col gap-s-4">
        <Skeleton className="h-40 rounded-md" />
        <Skeleton className="h-32 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
    )
  }

  if (error || !pro) {
    return (
      <div className="max-w-2xl mx-auto p-s-5">
        <Banner kind="warning">Professionnel introuvable ou erreur de chargement.</Banner>
      </div>
    )
  }

  const fullName = `${pro.profiles.first_name} ${pro.profiles.last_name}`
  const specialty = SPECIALTY_LABELS[pro.specialty_ids?.[0]] ?? pro.specialty_ids?.[0] ?? 'Professionnel de santé'
  const isVerified = pro.establishments.some(e => e.organizations?.is_verified)

  return (
    <div className="max-w-2xl mx-auto p-s-5 flex flex-col gap-s-4">
      {/* Hero card */}
      <Card className="p-s-5">
        <div className="flex items-start gap-s-4">
          {pro.profiles.avatar_url
            ? <img src={pro.profiles.avatar_url} alt={fullName} className="w-18 h-18 rounded-full object-cover shrink-0" style={{ width: 72, height: 72 }} />
            : <Initials name={fullName} />
          }
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-s-2 flex-wrap">
              <h1 className="text-ink font-semibold text-xl">{fullName}</h1>
              {isVerified && <Badge variant="success" size="sm">Vérifié</Badge>}
              {pro.teleconsultation_enabled && (
                <Badge variant="info" size="sm">
                  <Video className="w-3 h-3 mr-1" />Téléconsultation
                </Badge>
              )}
            </div>
            <p className="text-ink-2 text-sm mt-1">{specialty}</p>
            {pro.consultation_fee > 0 && (
              <p className="text-primary font-medium mt-1">{pro.consultation_fee.toLocaleString('fr-FR')} FCFA</p>
            )}
            {pro.languages?.length > 0 && (
              <div className="flex items-center gap-s-2 mt-s-2 flex-wrap">
                <Languages className="w-4 h-4 text-ink-3 shrink-0" />
                {pro.languages.map(lang => (
                  <span key={lang} className="text-xs bg-surface-2 text-ink-2 px-2 py-0.5 rounded-md">{lang}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-s-4 flex gap-s-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFav}
            disabled={favLoading || !user}
            className="flex items-center gap-s-2"
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-ink-3'}`} />
            {isFav ? 'Retirez des favoris' : 'Ajouter aux favoris'}
          </Button>
        </div>
      </Card>

      {/* Establishments */}
      {pro.establishments.length > 0 && (
        <section>
          <h2 className="text-ink font-medium mb-s-2">Cabinets</h2>
          <div className="flex flex-col gap-s-3">
            {pro.establishments.map(estab => (
              <Card key={estab.id} className="p-s-4">
                <div className="flex items-start justify-between gap-s-3">
                  <div className="min-w-0">
                    <p className="text-ink font-medium">{estab.organizations?.name}</p>
                    <div className="flex items-center gap-s-1 text-ink-3 text-sm mt-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{estab.organizations?.city}{estab.organizations?.address ? ` — ${estab.organizations.address}` : ''}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/app/rdv/nouveau?pro=${professionalId}&etab=${estab.id}`)}
                  >
                    Prendre RDV
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Qualifications */}
      {pro.professional_qualifications?.length > 0 && (
        <section>
          <h2 className="text-ink font-medium mb-s-2">Formations</h2>
          <div className="flex flex-col gap-s-2">
            {pro.professional_qualifications.map(q => (
              <div key={q.id} className="flex items-start gap-s-3 p-s-3 bg-surface-2 rounded-md">
                <GraduationCap className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" />
                <div>
                  <p className="text-ink text-sm font-medium">{q.degree}</p>
                  {(q.institution || q.year) && (
                    <p className="text-ink-3 text-xs">{[q.institution, q.year].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
