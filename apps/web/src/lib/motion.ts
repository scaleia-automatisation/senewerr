import type { Variants } from 'framer-motion'

// ── Page-level transitions ────────────────────────────────────────────────────

/** Transition d'entrée/sortie d'une page entière (route change). */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] } },
}

// ── Stagger container ─────────────────────────────────────────────────────────

/** Container qui déclenche l'animation en cascade sur ses enfants `itemVariants`. */
export const containerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren:   0.04,
    },
  },
  exit: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
}

// ── Item staggeré ─────────────────────────────────────────────────────────────

/** Enfant direct d'un `containerVariants`. */
export const itemVariants: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] },
  },
  exit: {
    opacity: 0, y: -6,
    transition: { duration: 0.14 },
  },
}

// ── Fade simple ───────────────────────────────────────────────────────────────

export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.12 } },
}

// ── Slide latéral (modals, drawers, panels) ───────────────────────────────────

export const slideRightVariants: Variants = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } },
  exit:    { opacity: 0, x: 32, transition: { duration: 0.16 } },
}

export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } },
  exit:    { opacity: 0, y: 16, transition: { duration: 0.14 } },
}

// ── Collapse hauteur (accordéon) ──────────────────────────────────────────────

export const collapseVariants: Variants = {
  initial: { height: 0, opacity: 0, overflow: 'hidden' },
  animate: {
    height: 'auto', opacity: 1,
    transition: { height: { duration: 0.24 }, opacity: { duration: 0.18, delay: 0.04 } },
  },
  exit: {
    height: 0, opacity: 0,
    transition: { height: { duration: 0.18 }, opacity: { duration: 0.1 } },
  },
}

// ── Scale (badges, notifications) ────────────────────────────────────────────

export const popVariants: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 22 } },
  exit:    { scale: 0.8, opacity: 0, transition: { duration: 0.1 } },
}

// ── Transition partagée par défaut ────────────────────────────────────────────

export const defaultTransition = {
  duration: 0.22,
  ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
}
