import { forwardRef } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

export interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Active la variante « recherche intelligente » (icône étincelle) */
  smart?: boolean
  loading?: boolean
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { smart, loading, className, ...props },
  ref,
) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-s-3 text-ink-3">
        {smart ? <Sparkles className="h-5 w-5 text-primary" /> : <Search className="h-5 w-5" />}
      </span>
      <input
        ref={ref}
        type="search"
        className={cn(
          'h-12 w-full rounded-pill border border-line bg-surface pl-[44px] pr-[44px] text-body text-ink',
          'placeholder:text-ink-3 focus:outline-none focus:border-primary focus:shadow-focus',
          className,
        )}
        {...props}
      />
      {loading && (
        <span className="absolute right-s-3">
          <Spinner size="sm" />
        </span>
      )}
    </div>
  )
})
