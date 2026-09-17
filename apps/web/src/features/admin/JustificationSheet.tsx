import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface JustificationSheetProps {
  open: boolean
  onConfirm: (cause: string) => void
  onCancel: () => void
  title?: string
}

// ─────────────────────────────────────────────────────────────
// JustificationSheet component
// ─────────────────────────────────────────────────────────────
export function JustificationSheet({
  open,
  onConfirm,
  onCancel,
  title = 'Justification d\'accès requise',
}: JustificationSheetProps) {
  const [cause, setCause] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    if (cause.trim().length < 20) {
      setError('La justification doit contenir au moins 20 caractères.')
      return
    }
    setError(null)
    onConfirm(cause.trim())
    setCause('')
  }

  function handleCancel() {
    setCause('')
    setError(null)
    onCancel()
  }

  return (
    <Modal
      open={open}
      onOpenChange={open => { if (!open) handleCancel() }}
      title={title}
      description="L'accès à ces données de santé nécessite une justification tracée dans les journaux d'audit."
      size="md"
      hideClose={false}
    >
      <div className="flex flex-col gap-s-4">
        <div className="flex flex-col gap-s-1">
          <label className="text-small font-medium text-ink" htmlFor="justif-textarea">
            Motif de consultation{' '}
            <span className="text-ink-3 font-normal">(20 caractères min.)</span>
          </label>
          <textarea
            id="justif-textarea"
            value={cause}
            onChange={e => { setCause(e.target.value); setError(null) }}
            rows={4}
            placeholder="Ex : Contrôle de sécurité suite à signalement patient — dossier #2024-001"
            className="w-full rounded-md border border-line bg-bg px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
          {error && <p className="text-micro text-status-danger">{error}</p>}
          <p className="text-micro text-ink-3 text-right">{cause.length} / 20 min</p>
        </div>

        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={handleCancel}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={cause.trim().length < 20}
          >
            Confirmer l'accès
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// useJustification hook
// ─────────────────────────────────────────────────────────────
interface UseJustificationOptions {
  entityType: string
  entityId: string
  action: string
}

interface UseJustificationReturn {
  /** Call to prompt the user; resolves to the cause string or null if cancelled */
  requestJustification: () => Promise<string | null>
  /** Render this node in your JSX tree */
  JustificationSheetNode: ReactNode
}

export function useJustification({
  entityType,
  entityId,
  action,
}: UseJustificationOptions): UseJustificationReturn {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)

  // Store resolve/reject for the pending promise
  const resolveRef = useRef<((cause: string | null) => void) | null>(null)

  const requestJustification = useCallback((): Promise<string | null> => {
    return new Promise(resolve => {
      resolveRef.current = resolve
      setOpen(true)
    })
  }, [])

  function handleConfirm(cause: string) {
    setOpen(false)
    // Write audit log with justification cause
    supabase
      .from('audit_logs')
      .insert({
        action,
        actor_id: profile?.id ?? null,
        target_type: entityType,
        target_id: entityId,
        metadata: { justification: cause },
        result: 'success',
      } as any)
      .then(({ error }) => {
        if (error) console.warn('[JustificationAudit]', error.message)
      })
    resolveRef.current?.(cause)
    resolveRef.current = null
  }

  function handleCancel() {
    setOpen(false)
    resolveRef.current?.(null)
    resolveRef.current = null
  }

  const JustificationSheetNode = (
    <JustificationSheet
      open={open}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { requestJustification, JustificationSheetNode }
}
