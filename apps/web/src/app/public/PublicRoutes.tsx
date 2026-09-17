import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageSpinner }  from '@/components/ui/Spinner'

const LandingPage           = lazy(() => import('@/features/landing/LandingPage'))
const BlogIndexPage         = lazy(() => import('@/features/blog/BlogIndexPage'))
const BlogArticlePage       = lazy(() => import('@/features/blog/BlogArticlePage'))
const LoginPage             = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage          = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage    = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage     = lazy(() => import('@/features/auth/ResetPasswordPage'))
const EmailVerificationPage = lazy(() => import('@/features/auth/EmailVerificationPage'))
const TwoFactorPage         = lazy(() => import('@/features/auth/TwoFactorPage'))
const InvitationPage           = lazy(() => import('@/features/auth/InvitationPage'))
const VerifyPrescriptionPage      = lazy(() => import('@/features/public/VerifyPrescriptionPage'))
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

function AuthCallbackPage() {
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
        {/* Landing + blog + legal — avec Header/Footer */}
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="tarifs" element={<PricingPage />} />
          <Route path="blog" element={<BlogIndexPage />} />
          <Route path="blog/:slug" element={<BlogArticlePage />} />
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
          <Route path="contact"          element={<ContactPage />} />
          <Route path="securite"         element={<Securite />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Auth — sans Header/Footer */}
        <Route path="auth/connexion"            element={<LoginPage />} />
        <Route path="auth/inscription"          element={<RegisterPage />} />
        <Route path="auth/mot-de-passe-oublie"  element={<ForgotPasswordPage />} />
        <Route path="auth/nouveau-mot-de-passe" element={<ResetPasswordPage />} />
        <Route path="auth/verification-email"   element={<EmailVerificationPage />} />
        <Route path="auth/callback"             element={<AuthCallbackPage />} />
        <Route path="auth/2fa"                  element={<TwoFactorPage />} />

        {/* Invitations (accessible sans être connecté pour permettre l'inscription) */}
        <Route path="invitation/:token" element={<InvitationPage />} />

        {/* Vérification publique d'ordonnance */}
        <Route path="verifier/:qrToken" element={<VerifyPrescriptionPage />} />
      </Routes>
    </Suspense>
  )
}
