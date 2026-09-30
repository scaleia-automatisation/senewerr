// Spec 27.4 — Journalisation des opérations sensibles
// Enregistre : utilisateur, rôle, organisation, action, objet, date/heure, résultat.
// Ne doit PAS contenir le contenu des dossiers médicaux.

import { createClient } from '@/lib/supabase/server'

export type AuditResult = 'success' | 'failure' | 'blocked'

export type AuditEntry = {
  action: string                    // ex: 'prescription.shared', 'consent.withdrawn'
  result: AuditResult
  actor_role?: string               // rôle explicite si connu, sinon déduit du profil
  organisation_id?: string          // ID de l'organisation concernée
  organisation_type?: string        // 'pharmacy' | 'establishment' | 'coverage_org'
  object_type?: string              // 'prescription' | 'document' | 'patient' | ...
  object_id?: string                // UUID de l'objet — jamais le contenu
  category?: string                 // groupement fonctionnel pour filtrage admin
  // Spec 27.4 : metadata ne doit PAS contenir le contenu de dossiers médicaux
  metadata?: Record<string, string | number | boolean | null>
}

// Champs interdits en metadata (spec 27.4)
const FORBIDDEN_METADATA_KEYS = [
  'clinical_notes', 'diagnosis', 'treatment_plan', 'chief_complaint',
  'content', 'document_content', 'file_content', 'medical_notes',
]

function sanitizeMetadata(
  meta?: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  if (!meta) return {}
  const sanitized: Record<string, string | number | boolean | null> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (!FORBIDDEN_METADATA_KEYS.includes(k)) sanitized[k] = v
  }
  return sanitized
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    type InsertFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
    await (supabase.from('system_events') as unknown as InsertFn).insert({
      event_type: entry.action,
      actor_id: user?.id ?? null,
      actor_type: entry.actor_role ?? null,
      object_type: entry.object_type ?? null,
      object_id: entry.object_id ?? null,
      result: entry.result,
      category: entry.category ?? deriveCategory(entry.action),
      metadata: {
        ...sanitizeMetadata(entry.metadata),
        organisation_id: entry.organisation_id ?? null,
        organisation_type: entry.organisation_type ?? null,
      },
      created_at: new Date().toISOString(),
    })
  } catch {
    // L'échec du logging ne doit pas bloquer l'opération principale
    // (silencieux en production, visible en dev via console)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[audit] logAudit failed silently', entry.action)
    }
  }
}

function deriveCategory(action: string): string {
  const prefix = action.split('.')[0]
  const map: Record<string, string> = {
    prescription: 'consultations', appointment: 'rdv', consultation: 'consultations',
    reservation: 'pharmacie', payment: 'paiements', coverage: 'couverture',
    document: 'documents', consent: 'consentements', account: 'comptes',
    admin: 'administration', platform: 'systeme', feature: 'systeme',
  }
  return map[prefix] ?? 'systeme'
}

// Raccourci pour les actions sensibles sur les données de santé (spec 27.2)
export async function logHealthDataAccess(opts: {
  action: 'read' | 'write' | 'share' | 'export'
  resourceType: 'prescription' | 'health_record' | 'document' | 'consultation'
  resourceId: string
  patientId?: string
}): Promise<void> {
  await logAudit({
    action: `${opts.resourceType}.${opts.action}`,
    result: 'success',
    object_type: opts.resourceType,
    object_id: opts.resourceId,
    category: 'acces_donnees_sante',
    // Jamais le contenu — seulement l'ID et le type (spec 27.4)
    metadata: opts.patientId ? { patient_id: opts.patientId } : {},
  })
}
