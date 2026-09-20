import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageSpinner }  from '@/components/ui/Spinner'
import { useAuthContext } from '@/features/auth/AuthContext'

const LandingPage           = lazy(() => import('@/features/landing/LandingPage'))
const LoginPage             = lazy(() => import('@/features/auth/LoginPage'))
const ProLandingPage            = lazy(() => import('@/features/landing/ActorLandingPages').then(m => ({ default: m.ProLandingPage })))
const EstablishmentLandingPage  = lazy(() => import('@/features/landing/ActorLandingPages').then(m => ({ default: m.EstablishmentLandingPage })))
const PharmacyLandingPage       = lazy(() => import('@/features/landing/ActorLandingPages').then(m => ({ default: m.PharmacyLandingPage })))
const InsuranceLandingPage      = lazy(() => import('@/features/landing/ActorLandingPages').then(m => ({ default: m.InsuranceLandingPage })))
const SuppressionDonnees        = lazy(() => import('@/features/legal/SuppressionDonnees'))
const RegisterPage          = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage    = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage     = lazy(() => import('@/features/auth/ResetPasswordPage'))
const EmailVerificationPage = lazy(() => import('@/features/auth/EmailVerificationPage'))
const TwoFactorPage         = lazy(() => import('@/features/auth/TwoFactorPage'))
const InvitationPage           = lazy(() => import('@/features/auth/InvitationPage'))
const VerifyPrescriptionPage      = lazy(() => import('@/features/public/VerifyPrescriptionPage'))
const OAuthRoleSelectPage         = lazy(() => import('@/features/auth/OAuthRoleSelectPage'))
const PricingPage                 = lazy(() => import('@/features/landing/PricingPage'))
const ProfessionalPublicPage      = lazy(() => import('@/features/public/ProfessionalPublicPage'))
const PharmacyPublicPage          = lazy(() => import('@/features/public/PharmacyPublicPage'))
const PublicSearchPage            = lazy(() => import('@/features/public/PublicSearchPage'))

// Legal pages (BLOC 8)
const MentionsLegales          = lazy(() => import('@/features/legal/MentionsLegales'))
const PolitiqueConfidentialite = lazy(() => import('@/features/legal/PolitiqueConfidentialite'))
const CGU                      = lazy(() => import('@/features/legal/CGU'))
const CGV                      = lazy(() => import('@/features/legal/CGV'))
const Cookies                  = lazy(() => import('@/features/legal/Cookies'))
const Remboursements           = lazy(() => import('@/features/legal/Remboursements'))
const ContactPage              = lazy(() => import('@/features/legal/Contact'))
const Securite                 = lazy(() => import('@/features/legal/Securite'))

const ROLE_DESTINATIONS: Record<string, string> = {
  patient:              '/patient',
  professional:         '/pro',
  establishment_admin:  '/etablissement',
  establishment_staff:  '/etablissement',
  pharmacy_admin:       '/pharmacie',
  pharmacy_staff:       '/pharmacie',
  mutual_admin:         '/mutuelle',
  mutual_staff:         '/mutuelle',
  platform_admin:       '/admin',
  super_admin:          '/admin',
}

function AuthCallbackPage() {
  const { session, profile, loading } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!session) {
      navigate('/auth/connexion', { replace: true })
      return
    }
    // New Google OAuth users must choose their profile before continuing
    const isOAuth = session.user.app_metadata?.provider === 'google'
    const onboardingDone = !!(profile as any)?.onboarding_completed_at
    if (isOAuth && !onboardingDone) {
      navigate('/auth/choisir-profil', { replace: true })
      return
    }
    const dest = (profile?.role && ROLE_DESTINATIONS[profile.role]) ?? '/'
    navigate(dest, { replace: true })
  }, [loading, session, profile, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <PageSpinner />
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-s-4 text-center">
      <p className="mb-s-4 font-display text-display font-semibold text-primary">404</p>
      <h1 className="mb-s-2 font-display text-h1 font-semibold text-ink">Page introuvable</h1>
      <p className="mb-s-6 text-body text-ink-2">Cette page n'existe pas ou a été déplacée.</p>
      <a href="/" className="font-medium text-primary hover:underline">Retour à l'accueil</a>
    </div>
  )
}

export default function PublicRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Landing — layout intégré (NavBar + Footer propres) */}
        <Route index element={<LandingPage />} />

        {/* Tarifs + acteurs + profils publics + légal — avec Header/Footer commun */}
        <Route element={<PublicLayout />}>
          <Route path="tarifs" element={<PricingPage />} />
          {/* Actor landing pages */}
          <Route path="acteurs/medecins"       element={<ProLandingPage />} />
          <Route path="acteurs/etablissements" element={<EstablishmentLandingPage />} />
          <Route path="acteurs/pharmacies"     element={<PharmacyLandingPage />} />
          <Route path="acteurs/mutuelles"      element={<InsuranceLandingPage />} />
          {/* Public profiles */}
          <Route path="pro/:slug" element={<ProfessionalPublicPage />} />
          <Route path="pharmacie/:slug" element={<PharmacyPublicPage />} />
          <Route path="recherche-publique" element={<PublicSearchPage />} />
          {/* Legal pages (BLOC 8) */}
          <Route path="mentions-legales" element={<MentionsLegales />} />
          <Route path="confidentialite"  element={<PolitiqueConfidentialite />} />
          <Route path="cgu"              element={<CGU />} />
          <Route path="cgv"              element={<CGV />} />
          <Route path="cookies"          element={<Cookies />} />
          <Route path="remboursements"   element={<Remboursements />} />
          <Route path="contact"              element={<ContactPage />} />
          <Route path="securite"             element={<Securite />} />
          <Route path="suppression-donnees"  element={<SuppressionDonnees />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Auth — sans Header/Footer */}
        <Route path="auth/connexion"            element={<LoginPage />} />
        <Route path="auth/inscription"          element={<RegisterPage />} />
        <Route path="auth/mot-de-passe-oublie"  element={<ForgotPasswordPage />} />
        <Route path="auth/nouveau-mot-de-passe" element={<ResetPasswordPage />} />
        <Route path="auth/verification-email"   element={<EmailVerificationPage />} />
        <Route path="auth/callback"             element={<AuthCallbackPage />} />
        <Route path="auth/choisir-profil"       element={<OAuthRoleSelectPage />} />
        <Route path="auth/2fa"                  element={<TwoFactorPage />} />

        {/* Invitations (accessible sans être connecté pour permettre l'inscription) */}
        <Route path="invitation/:token" element={<InvitationPage />} />

        {/* Vérification publique d'ordonnance */}
        <Route path="verifier/:qrToken" element={<VerifyPrescriptionPage />} />
      </Routes>
    </Suspense>
  )
}
