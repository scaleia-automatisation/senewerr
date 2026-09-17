import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-16 items-center px-s-4 sm:px-s-6">
        <Link to="/" className="flex items-center gap-s-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <span className="font-display text-body font-semibold text-primary-fg">M</span>
          </div>
          <span className="font-display text-h3 font-semibold text-ink">Medikool</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-s-4 py-s-6">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-line bg-surface p-s-6 shadow-1">
            <div className="mb-s-5 text-center">
              <h1 className="font-display text-h1 font-semibold text-ink">{title}</h1>
              {subtitle && <p className="mt-s-2 text-small text-ink-2">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="mt-s-4 text-center text-small text-ink-2">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
