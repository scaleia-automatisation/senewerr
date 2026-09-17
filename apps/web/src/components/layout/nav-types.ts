export interface NavLink {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
  /** true = visible dans la BottomNav mobile (max 4, le reste va dans « Plus ») */
  primary?: boolean
}

export interface SpaceNav {
  roleLabel: string
  links: NavLink[]
}
