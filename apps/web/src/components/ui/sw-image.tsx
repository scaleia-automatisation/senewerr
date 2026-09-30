'use client'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useState } from 'react'

/* ── HeroImage ─────────────────────────────────────────────────────────────
 * Image pleine largeur pour les sections hero des pages publiques.
 * Affiche un placeholder coloré pendant le chargement.
 */
interface HeroImageProps {
  src: string
  alt: string
  className?: string
  priority?: boolean
}

export function HeroImage({ src, alt, className, priority = true }: HeroImageProps) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-[var(--sw-surface-3)]', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className={cn(
          'object-cover transition-opacity duration-700',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setLoaded(true)}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
      />
      {/* Skeleton shimmer pendant le chargement */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--sw-surface-3)] via-[var(--sw-line)] to-[var(--sw-surface-3)] animate-shimmer" />
      )}
    </div>
  )
}

/* ── ActorImage ────────────────────────────────────────────────────────────
 * Image contextuelle pour les landing pages acteurs.
 * Ratio 3:2 (1536x1024) avec overlay dégradé optionnel en bas.
 */
interface ActorImageProps {
  src: string
  alt: string
  className?: string
  overlay?: boolean
}

export function ActorImage({ src, alt, className, overlay = true }: ActorImageProps) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={cn('relative overflow-hidden rounded-3xl bg-[var(--sw-surface-3)]', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority
        className={cn(
          'object-cover transition-opacity duration-700',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setLoaded(true)}
        sizes="(max-width: 768px) 100vw, 900px"
      />
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
      )}
      {!loaded && (
        <div className="absolute inset-0 bg-[var(--sw-surface-3)] animate-pulse" />
      )}
    </div>
  )
}

/* ── ProductScreenshot ─────────────────────────────────────────────────────
 * Cadre pour les captures d'écran de l'application.
 * Simule un écran/navigateur avec bordure et ombre.
 */
interface ScreenshotProps {
  src: string
  alt: string
  className?: string
}

export function ProductScreenshot({ src, alt, className }: ScreenshotProps) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl bg-[var(--sw-ink)] p-2 shadow-2xl',
      className
    )}>
      {/* Barre de fenêtre fictive */}
      <div className="flex items-center gap-1.5 px-2 pb-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--sw-danger)] opacity-70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--sw-warning)] opacity-70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--sw-success)] opacity-70" />
      </div>
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[var(--sw-surface-3)]">
        <Image
          src={src}
          alt={alt}
          fill
          className={cn('object-cover transition-opacity duration-700', loaded ? 'opacity-100' : 'opacity-0')}
          onLoad={() => setLoaded(true)}
          sizes="(max-width: 768px) 100vw, 800px"
        />
      </div>
    </div>
  )
}
