import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hideClose?: boolean
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }

export function Modal({ open, onOpenChange, title, description, children, size = 'md', hideClose }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-lg bg-surface p-s-5 shadow-2',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2',
            'data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            sizes[size],
          )}
        >
          {(title || !hideClose) && (
            <div className="mb-s-4 flex items-start justify-between gap-s-4">
              <div>
                {title && <Dialog.Title className="text-h3 font-semibold text-ink">{title}</Dialog.Title>}
                {description && (
                  <Dialog.Description className="mt-s-1 text-small text-ink-3">{description}</Dialog.Description>
                )}
              </div>
              {!hideClose && (
                <Dialog.Close className="shrink-0 rounded-sm p-s-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Fermer</span>
                </Dialog.Close>
              )}
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { Dialog }
