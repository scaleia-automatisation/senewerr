import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Stethoscope, Building2, Pill, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from './AuthContext'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type Choice = {
  role: string
  label: string
  description: string
  icon: React.ReactNode
  dest: string
}

const CHOICES: Choice[] = [
  {
    role: 'patient',
    label: 'Patient',
    description: 'Chercher des médicaments, consulter des professionnels, gérer mes ordonnances.',
    icon: <User className="h-7 w-7" />,
    dest: '/patient',
  },
  {
    role: 'professional',
    label: 'Professionnel de santé',
    description: 'Médecin, spécialiste, infirmier — gérer mon agenda et mes patients.',
    icon: <Stethoscope className="h-7 w-7" />,
    dest: '/pro',
  },
  {
    role: 'establishment_admin',
    label: 'Établissement de santé / Laboratoire',
    description: "Hôpital, clinique, centre médical, laboratoire d'analyses biologiques.",
    icon: <Building2 className="h-7 w-7" />,
    dest: '/etablissement',
  },
  {
    role: 'pharmacy_admin',
    label: 'Pharmacie',
    description: 'Gérer mon stock, recevoir des commandes et réservations.',
    icon: <Pill className="h-7 w-7" />,
    dest: '/pharmacie',
  },
  {
    role: 'mutual_admin',
    label: 'Mutuelle / Assurance',
    description: 'Valider les assurés, suivre les remboursements.',
    icon: <Shield className="h-7 w-7" />,
    dest: '/mutuelle',
  },
]

export default function OAuthRoleSelectPage() {
  const { session } = useAuthContext()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!selected || !session) return
    setLoading(true)
    setError(null)
    try {
      const choice = CHOICES.find(c => c.role === selected)!
      const { error: err } = await supabase
        .from('profiles')
        .update({
          role: selected,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('user_id', session.user.id)
      if (err) throw err
      navigate(choice.dest, { replace: true })
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Quel est votre profil ?" subtitle="Choisissez votre rôle pour accéder à l'espace qui vous correspond.">
      <div className="space-y-s-3">
        {CHOICES.map(c => (
          <button
            key={c.role}
            onClick={() => setSelected(c.role)}
            className={cn(
              'w-full flex items-start gap-s-4 rounded-xl border-2 p-s-4 text-left transition-all duration-fast',
              selected === c.role
                ? 'border-primary bg-primary-soft'
                : 'border-line bg-surface hover:border-primary/40 hover:bg-surface-2',
            )}
          >
            <span className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
              selected === c.role ? 'bg-primary text-white' : 'bg-surface-2 text-ink-2',
            )}>
              {c.icon}
            </span>
            <div className="min-w-0">
              <p className={cn('font-semibold text-body', selected === c.role ? 'text-primary' : 'text-ink')}>
                {c.label}
              </p>
              <p className="mt-0.5 text-small text-ink-3 leading-snug">{c.description}</p>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-s-3 text-small text-status-danger">{error}</p>
      )}

      <Button
        className="mt-s-5 text-white w-full"
        disabled={!selected}
        loading={loading}
        onClick={handleConfirm}
      >
        Continuer
      </Button>
    </AuthLayout>
  )
}
