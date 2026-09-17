import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Building2, CheckCircle, XCircle } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button }     from '@/components/ui/Button'
import { Banner }     from '@/components/ui/Banner'
import { Spinner }    from '@/components/ui/Spinner'
import { toast }      from 'sonner'
import { supabase }   from '@/lib/supabase'

interface InvitationDetails {
  organization_name: string
  organization_type: string
  role:              string
  invited_by_name:   string
  expires_at:        string
}

const ROLE_LABELS: Record<string, string> = {
  owner:  'Propriétaire',
  admin:  'Administrateur',
  staff:  'Équipe',
}

const ORG_TYPE_LABELS: Record<string, string> = {
  establishment:     'Établissement de santé',
  pharmacy:          'Pharmacie',
  insurance_provider: 'Mutuelle / Assurance',
}

export default function InvitationPage() {
  const { token }    = useParams<{ token: string }>()
  const navigate     = useNavigate()
  const [details, setDetails]   = useState<InvitationDetails | null>(null)
  const [status, setStatus]     = useState<'loading' | 'valid' | 'expired' | 'error'>('loading')
  const [acting, setActing]     = useState<'accept' | 'refuse' | null>(null)

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    fetchInvitation()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchInvitation() {
    try {
      const { data, error } = await supabase.functions.invoke('organization-respond-invitation', {
        body: { token, action: 'preview' },
      })
      if (error || !data?.ok) {
        setStatus(data?.code === 'EXPIRED' ? 'expired' : 'error')
        return
      }
      setDetails(data.invitation)
      setStatus('valid')
    } catch {
      setStatus('error')
    }
  }

  async function respond(action: 'accept' | 'refuse') {
    if (!token) return
    setActing(action)
    try {
      const { data, error } = await supabase.functions.invoke('organization-respond-invitation', {
        body: { token, action },
      })
      if (error || !data?.ok) {
        toast.error(data?.message ?? 'Erreur lors du traitement. Réessayez.')
        return
      }
      if (action === 'accept') {
        toast.success('Invitation acceptée ! Bienvenue dans l\'organisation.')
        navigate('/auth/connexion', { replace: true })
      } else {
        toast.success('Invitation refusée.')
        navigate('/', { replace: true })
      }
    } catch {
      toast.error('Erreur réseau. Réessayez.')
    } finally {
      setActing(null)
    }
  }

  if (status === 'loading') {
    return (
      <AuthLayout title="Invitation" subtitle="Vérification en cours…">
        <div className="flex justify-center py-s-6">
          <Spinner size="lg" />
        </div>
      </AuthLayout>
    )
  }

  if (status === 'expired') {
    return (
      <AuthLayout title="Invitation expirée">
        <div className="flex flex-col items-center gap-s-4 py-s-4">
          <XCircle className="h-12 w-12 text-status-danger" aria-hidden />
          <Banner kind="warning">
            Ce lien d&apos;invitation a expiré (validité 72 h). Demandez à l&apos;administrateur de vous envoyer une nouvelle invitation.
          </Banner>
          <Button variant="secondary" onClick={() => navigate('/')} className="w-full">
            Retour à l'accueil
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (status === 'error' || !details) {
    return (
      <AuthLayout title="Invitation invalide">
        <div className="flex flex-col items-center gap-s-4 py-s-4">
          <XCircle className="h-12 w-12 text-status-danger" aria-hidden />
          <Banner kind="warning">Ce lien est invalide ou a déjà été utilisé.</Banner>
          <Button variant="secondary" onClick={() => navigate('/')} className="w-full">
            Retour à l'accueil
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Invitation reçue" subtitle="Vous avez été invité à rejoindre une organisation">
      <div className="flex flex-col gap-s-5">
        <div className="flex items-center gap-s-4 rounded-lg bg-surface-2 p-s-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-accent-soft">
            <Building2 className="h-6 w-6 text-accent" aria-hidden />
          </div>
          <div>
            <p className="font-display text-h3 font-semibold text-ink">
              {details.organization_name}
            </p>
            <p className="text-small text-ink-2">
              {ORG_TYPE_LABELS[details.organization_type] ?? details.organization_type}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-line p-s-4">
          <dl className="flex flex-col gap-s-3">
            <div className="flex items-center justify-between">
              <dt className="text-small text-ink-3">Rôle proposé</dt>
              <dd className="text-small font-medium text-ink">
                {ROLE_LABELS[details.role] ?? details.role}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-small text-ink-3">Invité par</dt>
              <dd className="text-small font-medium text-ink">{details.invited_by_name}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-small text-ink-3">Expire le</dt>
              <dd className="text-small font-medium text-ink">
                {new Date(details.expires_at).toLocaleString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex gap-s-3">
          <Button
            variant="secondary"
            className="flex-1"
            loading={acting === 'refuse'}
            disabled={acting === 'accept'}
            onClick={() => respond('refuse')}
          >
            <XCircle className="w-4 h-4 mr-s-2" />
            Refuser
          </Button>
          <Button
            className="flex-1"
            loading={acting === 'accept'}
            disabled={acting === 'refuse'}
            onClick={() => respond('accept')}
          >
            <CheckCircle className="w-4 h-4 mr-s-2" />
            Accepter
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
