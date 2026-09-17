# RUNBOOK — Medikool

Procédures opérationnelles pour le déploiement, la rotation des secrets, la restauration et les incidents.

## 1. Déploiement

### Local → Staging

```bash
# 1. Build et tests
cd apps/web && npm run build && npx vitest run

# 2. Appliquer les migrations sur staging
npx supabase db push --project-ref <STAGING_REF>

# 3. Déployer les Edge Functions
npx supabase functions deploy --project-ref <STAGING_REF>

# 4. Déployer le front sur Vercel
vercel --prod  # ou via CI/CD

# 5. Smoke test staging
curl https://staging.medikool.sn/health | jq .
```

### Staging → Production

**Prérequis** : tests E2E staging verts, SECURITY_REPORT.md mis à jour, sauvegarde pg_dump effectuée.

```bash
# 1. Sauvegarde préalable
pg_dump $DATABASE_URL | gzip | age -r $BACKUP_PUBLIC_KEY > backup_$(date +%Y%m%d).sql.gz.age

# 2. Migrations prod (idempotentes)
npx supabase db push --project-ref <PROD_REF>

# 3. Edge Functions prod
npx supabase functions deploy --project-ref <PROD_REF>

# 4. Tag et push front
git tag v1.0.0-mvp && git push origin v1.0.0-mvp
# CI déploie automatiquement sur Vercel prod

# 5. Smoke test prod
curl https://app.medikool.sn/health | jq .
# Vérifier chaque dépendance : db, stripe, openai, resend = ok
```

## 2. Rotation des secrets

### Quand faire une rotation ?
- Soupçon de fuite (commit accidentel, accès non autorisé détecté)
- Départ d'un membre de l'équipe avec accès
- Rotation périodique (tous les 90 jours recommandé)

### Procédure Supabase Edge Functions

```bash
# 1. Générer la nouvelle clé auprès du fournisseur
# 2. Mettre à jour les secrets Supabase (SANS modifier le code)
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref <PROD_REF>
npx supabase secrets set OPENAI_API_KEY=sk-... --project-ref <PROD_REF>
# etc.

# 3. Vérifier que les fonctions utilisent la nouvelle clé
curl https://<PROD_REF>.supabase.co/functions/v1/health | jq .stripe

# 4. Révoquer l'ancienne clé auprès du fournisseur
```

### Variables à ne jamais exposer
- `SUPABASE_SERVICE_ROLE_KEY` — uniquement Edge Functions + seed local
- `STRIPE_SECRET_KEY` — uniquement Edge Functions
- `OPENAI_API_KEY` — uniquement Edge Functions
- `RESEND_API_KEY` — uniquement Edge Functions
- `WAVE_SECRET_KEY` — uniquement Edge Functions
- `ORANGE_MONEY_SECRET` — uniquement Edge Functions

## 3. Restauration de base de données

```bash
# Restauration depuis pg_dump chiffré
age -d -i $BACKUP_PRIVATE_KEY backup_20260918.sql.gz.age | gunzip | psql $STAGING_DATABASE_URL

# Vérification post-restauration (5 objets)
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM profiles;"
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM appointments;"
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM pharmacy_reservations;"
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM payments;"
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs;"
```

### PITR Supabase
- Dashboard → Settings → Database → Point-in-Time Recovery
- Activer PITR pour une restauration à la minute près
- Procédure : Dashboard → Restore → Choisir le timestamp

## 4. Procédures d'incident

### P1 — Base de données inaccessible
1. Vérifier `/health` : `db.ok = false`
2. Vérifier le dashboard Supabase (Status page)
3. Si indisponibilité > 5 min : mettre le front en mode maintenance (`VITE_MAINTENANCE_MODE=true`)
4. Ouvrir un ticket Supabase support
5. Prévenir les utilisateurs via bandeau maintenance

### P2 — Paiement défaillant
1. Vérifier `/health` : `stripe.ok = false`
2. Vérifier status.stripe.com
3. Désactiver temporairement le bouton Stripe dans `platform_settings`
4. Activer fallback Wave/Orange uniquement

### P3 — Fuite de données suspectée
1. Révoquer immédiatement le token compromis
2. Rotation de tous les secrets
3. Vérifier `security_events` pour identifier l'étendue
4. Notifier les utilisateurs concernés sous 72h (obligation RGPD + CDP Sénégal)
5. Notifier la CDP Sénégal (www.cdp.sn) et la CNIL si utilisateurs EU concernés
6. Documenter dans un incident post-mortem

## 5. Checklist post-lancement

### J+1
- [ ] Vérifier Sentry : 0 erreur P1
- [ ] Vérifier `security_events` : pas d'anomalie
- [ ] Vérifier rapport IA : coûts OpenAI vs crédits débités
- [ ] Rapprochement PSP : 0 écart
- [ ] Lighthouse prod sur `/` et un article blog

### J+7
- [ ] Vérifier Search Console : sitemap indexé
- [ ] Vérifier analytics PostHog : parcours patient complet vu
- [ ] Revue des alertes Supabase (CPU, connexions, erreurs 5xx)
- [ ] Vérifier les pg_cron : tous les jobs ont tourné (table `cron_job_runs`)

## 6. Contacts d'urgence

| Rôle | Contact |
|---|---|
| Super admin Medikool | mousssdembel@gmail.com (2FA obligatoire) |
| Support technique | support@medikool.sn |
| DPO | dpo@medikool.sn |
| Sécurité | security@medikool.sn |
| CDP Sénégal | www.cdp.sn |
