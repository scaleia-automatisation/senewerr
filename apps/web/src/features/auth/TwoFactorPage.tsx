import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, Copy } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button }     from '@/components/ui/Button'
import { OTPInput }   from '@/components/ui/OTPInput'
import { Banner }     from '@/components/ui/Banner'
import { toast }      from 'sonner'
import { supabase }   from '@/lib/supabase'

type Mode = 'verify' | 'enroll'

export default function TwoFactorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [mode, setMode]           = useState<Mode>('verify')
  const [factorId, setFactorId]   = useState('')
  const [qrUri, setQrUri]         = useState('')
  const [secret, setSecret]       = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode]           = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [enrollStep, setEnrollStep] = useState<'qr' | 'codes'>('qr')
  const enrollInit = useRef(false)

  useEffect(() => {
    initFlow()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function initFlow() {
    // Récupérer les facteurs existants
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totp = factors?.totp?.find(f => f.status === 'verified')

    if (totp) {
      // Facteur vérifié → mode vérification
      setFactorId(totp.id)
      setMode('verify')
      const { data: ch } = await supabase.auth.mfa.challenge({ factorId: totp.id })
      if (ch?.id) setChallengeId(ch.id)
    } else if (!enrollInit.current) {
      // Pas de facteur → enrôlement
      enrollInit.current = true
      setMode('enroll')
      const { data: en } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (en?.id) {
        setFactorId(en.id)
        setQrUri(en.totp.qr_code)
        setSecret(en.totp.secret)
        // Générer 8 codes de secours (pseudo-aléatoires côté client — en prod, générés serveur)
        const codes = Array.from({ length: 8 }, () =>
          Math.random().toString(36).slice(2, 7).toUpperCase() + '-' +
          Math.random().toString(36).slice(2, 7).toUpperCase()
        )
        setBackupCodes(codes)
      }
    }
  }

  async function handleVerify() {
    if (code.length !== 6) { setError('Code à 6 chiffres requis'); return }
    setLoading(true)
    setError('')

    let cid = challengeId
    if (!cid) {
      const { data: ch } = await supabase.auth.mfa.challenge({ factorId })
      cid = ch?.id ?? ''
      setChallengeId(cid)
    }

    const { error: mfaError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: cid,
      code,
    })
    setLoading(false)

    if (mfaError) {
      setError('Code invalide. Vérifiez votre application d\'authentification.')
      setCode('')
      return
    }

    navigate(from, { replace: true })
  }

  async function handleEnrollVerify() {
    if (code.length !== 6) { setError('Code à 6 chiffres requis'); return }
    setLoading(true)
    setError('')

    const { data: ch } = await supabase.auth.mfa.challenge({ factorId })
    if (!ch?.id) { setLoading(false); setError('Erreur technique. Réessayez.'); return }

    const { error: mfaError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code,
    })
    setLoading(false)

    if (mfaError) {
      setError('Code invalide. Scannez à nouveau le QR code et réessayez.')
      setCode('')
      return
    }

    setEnrollStep('codes')
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    toast.success('Secret copié !')
  }

  if (mode === 'enroll' && enrollStep === 'qr') {
    return (
      <AuthLayout title="Activer la double authentification" subtitle="Sécurisez votre compte administrateur">
        <div className="flex flex-col gap-s-5">
          <Banner kind="info">
            Scannez le QR code avec Google Authenticator, Authy ou une app TOTP compatible.
          </Banner>

          {qrUri && (
            <div className="flex justify-center">
              <img
                src={qrUri}
                alt="QR code double authentification"
                className="h-48 w-48 rounded-md border border-line"
              />
            </div>
          )}

          {secret && (
            <div className="rounded-md bg-surface-2 p-s-3">
              <p className="mb-s-2 text-small text-ink-2">Ou saisissez le code manuellement :</p>
              <div className="flex items-center gap-s-2">
                <code className="flex-1 break-all font-mono text-small text-ink">{secret}</code>
                <button type="button" onClick={copySecret} aria-label="Copier le secret">
                  <Copy className="w-4 h-4 text-ink-3 hover:text-primary" />
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-s-2 text-small font-medium text-ink">Code de vérification</p>
            <OTPInput
              length={6}
              value={code}
              onChange={setCode}
              autoFocus
            />
            {error && (
              <p className="mt-s-2 text-small text-status-danger" role="alert">{error}</p>
            )}
          </div>

          <Button onClick={handleEnrollVerify} loading={loading} className="w-full">
            Vérifier et activer
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (mode === 'enroll' && enrollStep === 'codes') {
    return (
      <AuthLayout title="Codes de secours" subtitle="Conservez ces codes en lieu sûr">
        <div className="flex flex-col gap-s-5">
          <Banner kind="warning">
            Ces codes ne seront affichés qu&apos;une seule fois. Notez-les ou imprimez-les maintenant.
          </Banner>

          <div className="grid grid-cols-2 gap-s-2 rounded-md bg-surface-2 p-s-4">
            {backupCodes.map(c => (
              <code key={c} className="font-mono text-small text-ink">{c}</code>
            ))}
          </div>

          <Button
            onClick={() => navigate(from, { replace: true })}
            className="w-full"
          >
            J'ai sauvegardé mes codes
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Vérification en deux étapes" subtitle="Saisissez le code de votre application">
      <div className="flex flex-col gap-s-5">
        <div className="flex justify-center">
          <ShieldCheck className="h-12 w-12 text-accent" aria-hidden />
        </div>

        <p className="text-center text-small text-ink-2">
          Ouvrez votre application d'authentification et saisissez le code à 6 chiffres.
        </p>

        <OTPInput
          length={6}
          value={code}
          onChange={setCode}
          autoFocus
        />

        {error && (
          <p className="text-small text-status-danger text-center" role="alert">{error}</p>
        )}

        <Button onClick={handleVerify} loading={loading} className="w-full">
          Vérifier
        </Button>

        <button
          type="button"
          className="text-center text-small text-ink-3 hover:text-primary hover:underline"
          onClick={() => {/* TODO: flux code de secours */}}
        >
          Utiliser un code de secours
        </button>
      </div>
    </AuthLayout>
  )
}
