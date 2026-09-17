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
const VerifyPrescriptionPage   = lazy(() => import('@/features/public/VerifyPrescriptionPage'))

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
          <Route path="blog" element={<BlogIndexPage />} />
          <Route path="blog/:slug" element={<BlogArticlePage />} />
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
