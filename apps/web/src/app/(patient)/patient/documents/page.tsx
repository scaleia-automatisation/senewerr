import { createClient } from '@/lib/supabase/server'
import { FolderOpen, FileText, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

type DocType =
  | 'prescription' | 'consultation_report' | 'exam_request' | 'exam_result'
  | 'invoice' | 'receipt' | 'coverage_decision' | 'coverage_contract'
  | 'identity' | 'professional_license' | 'administrative' | 'other'

const DOC_TYPE_LABELS: Record<DocType, string> = {
  prescription: 'Ordonnance',
  consultation_report: 'Compte-rendu',
  exam_request: 'Demande d\'examen',
  exam_result: 'Résultat d\'examen',
  invoice: 'Facture',
  receipt: 'Reçu',
  coverage_decision: 'Décision couverture',
  coverage_contract: 'Contrat couverture',
  identity: 'Identité',
  professional_license: 'Licence professionnelle',
  administrative: 'Administratif',
  other: 'Autre',
}

const DOC_TYPE_COLORS: Record<DocType, string> = {
  prescription: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  consultation_report: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  exam_request: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  exam_result: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  invoice: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  receipt: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  coverage_decision: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  coverage_contract: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  identity: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  professional_license: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  administrative: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]',
  other: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

function formatFileSize(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'prescription', label: 'Ordonnances' },
  { key: 'consultation_report', label: 'Comptes-rendus' },
  { key: 'invoice', label: 'Factures' },
  { key: 'identity', label: 'Identité' },
]

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const activeTab = params.tab ?? 'all'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let query = supabase
    .from('documents')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (activeTab !== 'all') {
    query = query.eq('document_type', activeTab)
  }

  const { data: documentsRaw } = await query
  const documents = documentsRaw as unknown as Array<{
    id: string
    document_type: string | null
    file_size_bytes: number | null
    title: string
    description: string | null
    file_url: string | null
    created_at: string
  }> | null

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Documents</h1>
        <p className="text-sm text-[var(--sw-ink-3)] mt-0.5">
          {documents?.length ?? 0} document{(documents?.length ?? 0) !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <a
            key={tab.key}
            href={tab.key === 'all' ? '/patient/documents' : `/patient/documents?tab=${tab.key}`}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab.key
                ? 'bg-[var(--sw-primary)] text-white'
                : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)]'
            )}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {(!documents || documents.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--sw-surface-2)] flex items-center justify-center mb-4">
            <FolderOpen className="w-7 h-7 text-[var(--sw-ink-3)]" />
          </div>
          <p className="font-semibold text-[var(--sw-ink-2)]">Aucun document</p>
          <p className="text-sm text-[var(--sw-ink-3)] mt-1">Vos documents apparaîtront ici.</p>
        </div>
      )}

      <div className="space-y-3">
        {(documents ?? []).map(doc => {
          const docType = (doc.document_type as DocType) ?? 'other'
          const label = DOC_TYPE_LABELS[docType] ?? 'Autre'
          const colorClass = DOC_TYPE_COLORS[docType] ?? DOC_TYPE_COLORS.other
          const fileSize = formatFileSize(doc.file_size_bytes ?? null)

          return (
            <Card key={doc.id} className="sw-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[var(--sw-ink-2)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-[var(--sw-ink-3)] mt-0.5 line-clamp-2">{doc.description}</p>
                        )}
                      </div>
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[var(--sw-primary)] hover:text-[var(--sw-primary)] opacity-70 hover:opacity-100"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colorClass)}>
                        {label}
                      </span>
                      <span className="text-xs text-[var(--sw-ink-3)]">{formatDate(doc.created_at)}</span>
                      {fileSize && (
                        <span className="text-xs text-[var(--sw-ink-3)]">{fileSize}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
