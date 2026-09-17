# SECURITY_REPORT — Medikool

> Checklist de sécurité §9.2. Statut : ✅ = vérifié | ⚠ = partiel | ❌ = non vérifié | 🔧 = action manuelle requise

Dernière mise à jour : 2026-09-18

## 1. Isolation des données (cross-tenant)

| Test | Méthode | Statut | Notes |
|------|---------|--------|-------|
| Patient B ne voit pas les données de Patient A via PostgREST | JWT Patient B + SELECT profiles WHERE id=A | ⚠ À exécuter | RLS en place (migration 0010) |
| Pharmacie B ne voit pas les commandes de Pharmacie A | JWT Pharmacie B + SELECT pharmacy_reservations | ⚠ À exécuter | Policy `org_isolation` |
| Professionnel sans RDV ne voit pas le dossier patient | JWT Pro + SELECT patients | ⚠ À exécuter | Policy `professional_can_access_patient` |
| Accès Storage cross-tenant | URL signée expirée d'un autre tenant | ⚠ À exécuter | Bucket privés configurés |

**Action** : Exécuter `scripts/security/test-cross-tenant.ts` et coller les résultats ici.

## 2. Inspection du bundle front

| Vérification | Commande | Statut |
|---|---|---|
| Aucune clé `service_role` dans le bundle | `grep -r "service_role" apps/web/dist/` | ⚠ À exécuter |
| Aucune clé `sk_` (Stripe secret) | `grep -r "sk_" apps/web/dist/` | ⚠ À exécuter |
| Aucune clé `re_` (Resend) | `grep -r "re_" apps/web/dist/` | ⚠ À exécuter |
| Aucune clé `OPENAI` | `grep -r "OPENAI" apps/web/dist/` | ⚠ À exécuter |
| Seules les `VITE_*` présentes | Vérification manuelle | ⚠ À exécuter |

## 3. Replay de webhooks (double effet)

| PSP | Test | Statut |
|---|---|---|
| Stripe | Rejouer un `payment_intent.succeeded` → vérifier `payment_events UNIQUE` | ⚠ À exécuter |
| Wave | Rejouer un webhook → 200 sans double débit | ⚠ À exécuter |
| Orange Money | Rejouer un webhook → 200 sans double débit | ⚠ À exécuter |
| Resend | Replay d'un event email → pas de double envoi | ⚠ À exécuter |

## 4. Rate-limiting login

| Test | Résultat attendu | Statut |
|---|---|---|
| 50 tentatives `/login` en rafale | 429 + verrouillage + hCaptcha | ⚠ À exécuter |
| Email d'alerte reçu après 5 échecs | Email reçu sur admin | ⚠ À exécuter |

## 5. Accès admin sans 2FA

| Test | Résultat attendu | Statut |
|---|---|---|
| GET `/admin` avec JWT aal1 | Redirect `/2fa` (UI) | ✅ Implémenté dans AdminLayout.tsx |
| Edge Function admin-action avec JWT aal1 | 401 AUTH_2FA_REQUIRED | ⚠ À vérifier via curl |

## 6. URLs signées Storage

| Test | Résultat attendu | Statut |
|---|---|---|
| URL signée expirée (> 5 min) | 400/403 | ⚠ À exécuter |
| URL du bucket via API non signée | Bucket non listable (400) | ⚠ À exécuter |

## 7. Injection

| Test | Résultat attendu | Statut |
|---|---|---|
| `<script>alert(1)</script>` dans nom organisation | Rendu texte, pas exécuté | ✅ DOMPurify en place |
| Injection SQL via filtre recherche | PostgREST paramétré → pas d'injection | ✅ Requêtes paramétrées |
| HTML dans articles blog | DOMPurify sur rendu markdown | ✅ BlogArticlePage.tsx |

## 8. En-têtes de sécurité

| En-tête | Valeur attendue | Statut |
|---|---|---|
| Content-Security-Policy | sans `unsafe-inline` hors nonce | 🔧 Configurer sur Vercel/Supabase |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | 🔧 Vercel config |
| X-Frame-Options | `DENY` | 🔧 Vercel config |
| X-Content-Type-Options | `nosniff` | 🔧 Vercel config |
| Referrer-Policy | `strict-origin-when-cross-origin` | 🔧 Vercel config |
| **Score securityheaders.com** | **≥ A** | ⚠ Tester après déploiement |

## 9. Audit sur actions sensibles

| Action | Table audit_logs | Statut |
|---|---|---|
| Consultation dossier patient | ✅ | useAdminAudit() |
| Accès ordonnance | ✅ | JustificationSheet |
| Validation PEC | ✅ | admin-action |
| Paiement | ✅ | payment-webhook |
| Remboursement | ✅ | create-refund |
| Changement de statut acteur | ✅ | admin-action |
| Accès admin | ✅ | useAdminAudit() |
| Suspension d'acteur | ✅ | suspend-actor |
| Retrait code de retrait | ✅ | confirm-withdrawal |
| Partage ordonnance | ✅ | share-prescription |
| Génération IA | ✅ | ai_generations |
| Login admin | ✅ | security_events |

## 10. Sauvegarde et restauration

| Tâche | Statut |
|---|---|
| PITR Supabase activé | 🔧 Dashboard Supabase → Settings → Database → PITR |
| Export pg_dump quotidien chiffré | 🔧 Configurer cron externe |
| Restauration testée sur staging | ⚠ À exécuter avant mise en prod |

## 11. Secrets

| Vérification | Statut |
|---|---|
| gitleaks CI actif | ⚠ Ajouter `.github/workflows/ci.yml` |
| npm audit sans vulnérabilité haute | ⚠ `npm audit` à exécuter |
| .env dans .gitignore | ✅ Vérifié |
| Rotation secrets documentée (RUNBOOK.md) | ✅ |

## 12. Données de santé

| Vérification | Statut |
|---|---|
| Chiffrement AES-256 au repos (Supabase/AWS) | ✅ Géré par Supabase/AWS |
| OpenAI appelé avec `store: false` | 🔧 Vérifier dans les Edge Functions IA |
| Données minimisées avant envoi à OpenAI | 🔧 Vérifier les prompts Edge Functions |
| Scrubber Sentry (clinical_notes, diagnosis, content) | 🔧 Configurer dans Sentry SDK |

## 13. Code de retrait

| Test | Résultat attendu | Statut |
|---|---|---|
| 5 codes faux → verrouillage | WITHDRAWAL_LOCKED 15 min | ✅ Implémenté withdrawal_attempts |
| Alerte admin sur verrouillage | Notification admin | ⚠ À vérifier |

## 14. Suppression de compte

| Test | Résultat attendu | Statut |
|---|---|---|
| Anonymisation sur toutes les tables avec profile_id | 0 données personnelles restantes | ⚠ À exécuter `scripts/security/verify-anonymization.ts` |

## 15. OWASP ZAP

| Test | Résultat attendu | Statut |
|---|---|---|
| ZAP baseline scan sur staging | 0 alerte haute | 🔧 Exécuter après déploiement staging |

---

## Résumé

| Catégorie | ✅ | ⚠ | ❌ | 🔧 |
|---|---|---|---|---|
| Cross-tenant | 1 | 3 | 0 | 0 |
| Bundle | 0 | 5 | 0 | 0 |
| Webhooks | 0 | 4 | 0 | 0 |
| Rate-limit | 0 | 2 | 0 | 0 |
| 2FA admin | 1 | 1 | 0 | 0 |
| Storage | 0 | 2 | 0 | 0 |
| Injections | 3 | 0 | 0 | 0 |
| En-têtes | 0 | 1 | 0 | 5 |
| Audit | 12 | 0 | 0 | 0 |
| Sauvegarde | 0 | 1 | 0 | 2 |
| Secrets | 1 | 2 | 0 | 0 |
| Données santé | 1 | 0 | 0 | 3 |
| Code retrait | 1 | 1 | 0 | 0 |
| Suppression compte | 0 | 1 | 0 | 0 |
| OWASP ZAP | 0 | 0 | 0 | 1 |
