import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { useTheme } from '@/lib/theme'

const NAV_LINKS = [
  { href: '/#features', label: 'Fonctionnalités' },
  { href: '/#comment',  label: 'Comment ça marche' },
  { href: '/#tarifs',   label: 'Tarifs' },
  { href: '/blog',      label: 'Blog' },
]

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const { toggle } = useTheme()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-container items-center justify-between px-s-4 sm:px-s-6">
        <Link to="/" className="flex shrink-0 items-center gap-s-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <span className="font-display text-body font-semibold text-primary-fg">M</span>
          </div>
          <span className="font-display text-h3 font-semibold text-ink">Medikool</span>
        </Link>

        <nav className="hidden items-center gap-s-1 md:flex">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-s-3 py-s-2 text-small font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-s-2 md:flex">
          <IconButton aria-label="Basculer le thème" variant="ghost" onClick={toggle}>
            <Sun className="h-5 w-5 dark:hidden" />
            <Moon className="hidden h-5 w-5 dark:block" />
          </IconButton>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth/connexion">Se connecter</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth/inscription">Commencer</Link>
          </Button>
        </div>

        <button
          className="rounded-md p-s-2 text-ink-2 hover:bg-surface-2 md:hidden"
          onClick={() => setOpen(o => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-surface px-s-4 pb-s-4 md:hidden">
          <nav className="flex flex-col gap-s-1 pt-s-3">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-s-3 py-s-3 text-small font-medium text-ink-2 hover:bg-surface-2"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-s-4 flex flex-col gap-s-2 border-t border-line pt-s-4">
            <Button variant="secondary" asChild fullWidth>
              <Link to="/auth/connexion" onClick={() => setOpen(false)}>Se connecter</Link>
            </Button>
            <Button asChild fullWidth>
              <Link to="/auth/inscription" onClick={() => setOpen(false)}>Commencer</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
