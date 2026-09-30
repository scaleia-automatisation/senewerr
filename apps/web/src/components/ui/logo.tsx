'use client'

interface LogoIconProps {
  size?: number
  className?: string
}

/** Icône Séné Wérr — cœur + silhouette personne + croix médicale, dégradé bleu→teal→vert */
export function LogoIcon({ size = 32, className = '' }: LogoIconProps) {
  const id = `sw-grad-${size}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Séné Wérr"
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <rect width="100" height="100" rx="22" />
        </clipPath>
      </defs>

      {/* Fond arrondi dégradé */}
      <rect width="100" height="100" rx="22" fill={`url(#${id})`} />

      {/* Forme cœur + silhouette + croix en blanc */}
      <g clipPath={`url(#clip-${id})`}>
        {/* Cœur (path simplifié) */}
        <path
          d="M50 82 C50 82 14 58 14 36 C14 24 23 15 34 15 C40 15 46 18 50 23 C54 18 60 15 66 15 C77 15 86 24 86 36 C86 58 50 82 50 82Z"
          fill="white"
          opacity="0.9"
        />
        {/* Silhouette personne (tête + corps) */}
        <circle cx="42" cy="28" r="7" fill={`url(#${id})`} />
        <path
          d="M30 50 C30 42 36 36 44 36 C48 36 51 38 53 41"
          stroke={`url(#${id})`}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Croix médicale */}
        <rect x="57" y="38" width="18" height="6" rx="3" fill={`url(#${id})`} />
        <rect x="63" y="32" width="6" height="18" rx="3" fill={`url(#${id})`} />
      </g>
    </svg>
  )
}

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

/** Logo complet : icône + "Séné Wérr" */
export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 36
  const textClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl'

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} />
      {showText && (
        <span className={`font-bold tracking-tight text-[var(--sw-ink)] ${textClass}`}>
          Séné <span className="text-[var(--sw-primary)]">Wérr</span>
        </span>
      )}
    </div>
  )
}
