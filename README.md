# Medikool

Plateforme de coordination de parcours de santé au Sénégal.
Patient → Médecin → Ordonnance → Pharmacie → Mutuelle, dans un seul compte.

## Stack

- **Front** : React 19, Vite 6, TypeScript, Tailwind CSS
- **Backend** : Supabase (PostgreSQL 17, Auth, Storage, Edge Functions Deno, Realtime)
- **Paiements** : Stripe, Wave, Orange Money
- **IA** : OpenAI (gpt-4.1-mini, whisper-1)
- **Emails** : Resend
- **Monitoring** : Sentry, PostHog

## Setup local en 10 commandes

```bash
# 1. Cloner
git clone https://github.com/your-org/medikool.git && cd medikool

# 2. Installer les dépendances
npm install

# 3. Copier les variables d'environnement
cp .env.example apps/web/.env.local
# Remplir les valeurs dans apps/web/.env.local

# 4. Démarrer Supabase local
npx supabase start

# 5. Appliquer les migrations
npx supabase db reset

# 6. Déployer les Edge Functions en local
npx supabase functions serve

# 7. Lancer le seed (comptes de test)
# Requiert SUPABASE_SERVICE_ROLE_KEY dans l'env
deno run --allow-env --allow-net supabase/seed/seed.ts

# 8. Lancer le front
cd apps/web && npm run dev

# 9. Vérifier le build
cd apps/web && npm run build

# 10. Lancer les tests
npm run test
```

## Variables d'environnement

Copier `.env.example` → `apps/web/.env.local`. Les variables `VITE_*` sont publiques (bundle front). Toutes les autres restent côté serveur.

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (Edge Functions uniquement) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `OPENAI_API_KEY` | Clé OpenAI |
| `RESEND_API_KEY` | Clé Resend |
| `WAVE_SECRET_KEY` | Clé Wave |
| `ORANGE_MONEY_SECRET` | Clé Orange Money |
| `SENTRY_DSN` | DSN Sentry (front + Edge) |

## Comptes de test

Voir `supabase/seed/report.md`. Mot de passe : `00000000`. **Jamais en production.**

## Structure du projet

```
medikool/
├── apps/
│   └── web/           # Front React
├── packages/
│   └── shared/        # Types et erreurs partagés
├── supabase/
│   ├── functions/     # Edge Functions Deno
│   ├── migrations/    # Migrations SQL
│   ├── seed/          # Comptes de test
│   └── tests/         # pgTAP
├── scripts/           # Outils de build et vérification
└── docs/              # Documentation
```

## Commandes utiles

```bash
# Build front
cd apps/web && npm run build

# Tests unitaires
cd apps/web && npx vitest run

# Typecheck
cd apps/web && npx tsc --noEmit

# Lint
cd apps/web && npx eslint src/

# Tests pgTAP (nécessite Supabase local)
npx supabase test db

# Générer le sitemap
deno run --allow-env --allow-net --allow-write scripts/generate-sitemap.ts
```
