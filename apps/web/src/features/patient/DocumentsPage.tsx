import { useState, useEffect } from 'react'
import { FileText, Download, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Banner } from '@/components/ui/Banner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

interface Document {
  id: string
  title: string
  document_type: string
  document_date: string
  created_at: string
  content_text?: string
  storage_path?: string
}

const TYPE_LABELS: Record<string, string> = {
  compte_rendu_consultation: 'Compte rendu',
  lettre_medecin: 'Lettre médecin',
  certificat_medical: 'Certificat',
  ordonnance: 'Ordonnance',
  resultat_analyse: 'Résultat analyse',
  autre: 'Autre',
}

export default function DocumentsPage() {
  const { profile } = useAuth()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [explaining, setExplaining] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => { fetchDocs() }, [profile?.id])

  async function fetchDocs() {
    if (!profile?.id) return
    const { data } = await supabase
      .from('documents')
      .select('id, title, document_type, document_date, created_at, content_text, storage_path')
      .eq('patient_id', profile.id)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    TYPE_LABELS[d.document_type]?.toLowerCase().includes(search.toLowerCase())
  )

  async function explainDoc(doc: Document) {
    setExplaining(doc.id)
    setAiError(null)
    const { data, error } = await supabase.functions.invoke('ai-explain-document', {
      body: { documentId: doc.id },
    })
    setExplaining(null)
    if (error || !data?.explanation) {
      setAiError('Impossible de générer l\'explication. Réessayez.')
      return
    }
    setExplanations(e => ({ ...e, [doc.id]: data.explanation }))
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex flex-col gap-s-4 p-s-4">
      <h1 className="text-h2 font-display text-ink">Mes documents</h1>

      <Input
        label=""
        placeholder="Rechercher un document…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {aiError && <Banner kind="warning">{aiError}</Banner>}

      {loading && (
        <div className="flex flex-col gap-s-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          title="Aucun document"
          description={search ? 'Aucun document ne correspond à votre recherche.' : 'Vos documents médicaux apparaîtront ici.'}
        />
      )}

      <div className="flex flex-col gap-s-3">
        {filtered.map(doc => (
          <Card key={doc.id} className="p-s-4">
            <div className="flex items-start gap-s-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 shrink-0">
                <FileText className="w-5 h-5 text-ink-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-s-2">
                  <p className="font-medium text-ink truncate">{doc.title}</p>
                  <Badge variant="default">{TYPE_LABELS[doc.document_type] ?? doc.document_type}</Badge>
                </div>
                <p className="text-small text-ink-3 mt-s-1">
                  {formatDate(doc.document_date ?? doc.created_at)}
                </p>
              </div>
            </div>

            <div className="mt-s-3 flex gap-s-2">
              {doc.storage_path && (
                <Button variant="secondary" className="text-small">
                  <Download className="w-3 h-3 mr-s-1" />
                  Télécharger
                </Button>
              )}
              <Button
                variant="ghost"
                loading={explaining === doc.id}
                onClick={() => explainDoc(doc)}
                className="text-small"
              >
                <Sparkles className="w-3 h-3 mr-s-1" />
                Explication IA
              </Button>
            </div>

            {explanations[doc.id] && (
              <div className="mt-s-3 rounded-md bg-surface-2 p-s-3">
                <p className="text-small font-medium text-accent mb-s-1">Explication simplifiée</p>
                <p className="text-small text-ink whitespace-pre-wrap">{explanations[doc.id]}</p>
                <p className="mt-s-2 text-small text-ink-3 italic">Ceci est une aide à la compréhension, pas un avis médical.</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
