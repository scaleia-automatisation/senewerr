import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
}

export function ConfirmModal({
  open, onOpenChange, title, message,
  confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  variant = 'primary', loading = false, onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} size="sm">
      <div className="flex flex-col gap-s-4">
        {variant === 'danger' && (
          <div className="flex items-start gap-s-3 rounded-lg border border-red-200 bg-red-50 p-s-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-small text-red-800">{message}</p>
          </div>
        )}
        {variant !== 'danger' && (
          <p className="text-small text-ink-2">{message}</p>
        )}
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'primary' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
