import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Image as ImageIcon, Clock, ShieldX } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ShareDoc {
  nom: string
  type_mime: string
  fichier_url: string
  taille_bytes: number
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>()
  const db = supabase as any

  const [state, setState] = useState<'loading' | 'ok' | 'expired' | 'error'>('loading')
  const [doc, setDoc]     = useState<ShareDoc | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setState('error'); return }

    async function load() {
      // Fetch document via partage_token — RLS allows anon read when token matches
      const { data, error } = await db
        .from('documents')
        .select('nom, type_mime, fichier_url, taille_bytes, partage_expire_at')
        .eq('partage_token', token)
        .is('deleted_at', null)
        .single()

      if (error || !data) { setState('error'); return }

      const expired = !data.partage_expire_at || new Date(data.partage_expire_at) <= new Date()
      if (expired) { setState('expired'); return }

      setDoc({ nom: data.nom, type_mime: data.type_mime, fichier_url: data.fichier_url, taille_bytes: data.taille_bytes })

      const { data: signed } = await supabase.storage
        .from('documents-patients')
        .createSignedUrl(data.fichier_url, 3600)

      if (!signed?.signedUrl) { setState('error'); return }
      setSignedUrl(signed.signedUrl)
      setState('ok')
    }

    load()
  }, [token])

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-s-4 px-s-4 text-center">
        <Clock className="h-16 w-16 text-status-danger" />
        <h1 className="font-display text-h1 font-semibold text-ink">Ce lien a expiré</h1>
        <p className="max-w-sm text-body text-ink-2">
          Le lien de partage a dépassé sa durée de validité. Demandez un nouveau lien au propriétaire du document.
        </p>
      </div>
    )
  }

  if (state === 'error' || !doc || !signedUrl) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-s-4 px-s-4 text-center">
        <ShieldX className="h-16 w-16 text-ink-3" />
        <h1 className="font-display text-h1 font-semibold text-ink">Document introuvable</h1>
        <p className="max-w-sm text-body text-ink-2">
          Ce lien est invalide ou le document a été supprimé.
        </p>
      </div>
    )
  }

  const isPdf   = doc.type_mime === 'application/pdf'
  const isImage = doc.type_mime.startsWith('image/')

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {/* Header minimal */}
      <header className="border-b border-line px-s-4 py-s-3 flex items-center gap-s-3">
        <div className="flex items-center gap-s-2">
          {isImage ? <ImageIcon className="h-5 w-5 text-ink-3" /> : <FileText className="h-5 w-5 text-ink-3" />}
          <span className="font-medium text-ink truncate max-w-[200px] sm:max-w-xs">{doc.nom}</span>
        </div>
        <span className="text-micro text-ink-3 ml-auto">{formatBytes(doc.taille_bytes)}</span>
        <a
          href={signedUrl}
          download={doc.nom}
          className="ml-s-2 rounded-md bg-primary px-s-3 py-s-1.5 text-small font-medium text-white hover:bg-primary-dark"
        >
          Télécharger
        </a>
      </header>

      {/* Document */}
      <main className="flex-1 flex items-stretch px-s-4 py-s-4">
        {isImage ? (
          <img
            src={signedUrl}
            alt={doc.nom}
            className="mx-auto max-h-[80vh] max-w-full rounded-md object-contain"
          />
        ) : isPdf ? (
          <iframe
            src={signedUrl}
            title={doc.nom}
            className="w-full rounded-md border border-line"
            style={{ minHeight: 'calc(100vh - 120px)' }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-s-4">
            <FileText className="h-16 w-16 text-ink-3" />
            <p className="text-body text-ink-2">Aperçu non disponible pour ce type de fichier.</p>
            <a
              href={signedUrl}
              download={doc.nom}
              className="rounded-md bg-primary px-s-4 py-s-2 text-small font-medium text-white hover:bg-primary-dark"
            >
              Télécharger le fichier
            </a>
          </div>
        )}
      </main>

      {/* Footer discret */}
      <footer className="border-t border-line px-s-4 py-s-2 text-center text-micro text-ink-3">
        Document partagé via Séné Wérr — Accès temporaire et sécurisé
      </footer>
    </div>
  )
}
