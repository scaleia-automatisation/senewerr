import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, HelpCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface TocEntry {
  id: string
  text: string
}

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (!contentRef.current) return
    const headings = contentRef.current.querySelectorAll<HTMLElement>('h2[data-toc]')
    const entries: TocEntry[] = []
    headings.forEach((h) => {
      if (!h.id) {
        h.id = h.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ?? ''
      }
      entries.push({ id: h.id, text: h.textContent ?? '' })
    })
    setToc(entries)
  }, [children])

  useEffect(() => {
    if (toc.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    toc.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [toc])

  return (
    <div className="mx-auto max-w-screen-xl px-s-4 py-s-8 md:px-s-8">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="mb-s-4 flex items-center gap-s-1 text-small text-ink-3">
        <Link to="/" className="hover:text-ink transition-colors">Accueil</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="text-ink-2 font-medium">{title}</span>
      </nav>

      {/* Header */}
      <div className="mb-s-8">
        <h1 className="font-display text-h1 font-semibold text-ink mb-s-1">{title}</h1>
        <p className="text-small text-ink-3">Mis à jour le {lastUpdated}</p>
      </div>

      <div className="flex gap-s-8 items-start">
        {/* Main content */}
        <div ref={contentRef} className="min-w-0 flex-1 prose-legal">
          {children}
        </div>

        {/* Sidebar */}
        {toc.length > 0 && (
          <aside className="hidden xl:block w-64 shrink-0 sticky top-s-6">
            <nav aria-label="Table des matières">
              <p className="mb-s-3 text-small font-semibold uppercase tracking-widest text-ink-3">
                Sommaire
              </p>
              <ul className="flex flex-col gap-s-1">
                {toc.map(({ id, text }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={[
                        'block rounded-sm px-s-2 py-s-1 text-small transition-colors',
                        activeId === id
                          ? 'bg-primary-soft text-primary font-medium'
                          : 'text-ink-3 hover:text-ink',
                      ].join(' ')}
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Questions box */}
            <Card className="mt-s-6 p-s-4">
              <div className="flex items-start gap-s-2">
                <HelpCircle className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-small font-semibold text-ink mb-s-1">Une question ?</p>
                  <p className="text-small text-ink-3 mb-s-2">
                    Notre équipe répond sous 48 h ouvrées.
                  </p>
                  <Link
                    to="/contact"
                    className="text-small font-medium text-primary hover:underline"
                  >
                    Nous contacter →
                  </Link>
                </div>
              </div>
            </Card>
          </aside>
        )}
      </div>
    </div>
  )
}
