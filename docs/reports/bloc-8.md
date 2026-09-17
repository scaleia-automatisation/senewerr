# Rapport BLOC 8 — Comptes de test, pages légales, SEO/GEO, landing & blog

Date : 2026-09-18

## Build

- Vite build : ✅ 7.50s, 0 erreur
- TypeScript : ✅ 0 erreur dans les fichiers BLOC 8
- 138 entrées précachées (PWA)

## Tests Vitest

- 3 fichiers de test, 22 tests — tous passés ✅
  - `src/lib/status.test.ts` — 5 tests (statuts rendez-vous / réservations / PEC / ordonnances)
  - `src/lib/utils.test.ts` — 11 tests (formatFCFA, formatFCFACompact, formatRelativeDateTime, slugify)
  - `src/components/ui/Button.test.tsx` — 6 tests (composant Button)

## Livrables

### 8.1 Seed
- `supabase/seed/seed.ts` — 18 comptes de test (10 principaux + 8 supplémentaires)
- `supabase/seed/report.md` — tableau des comptes
- 7 organisations créées
- 12 médicaments de référence
- 12 questions FAQ
- 6 articles blog

### 8.2 Pages légales (8 pages)
- /mentions-legales ✅
- /confidentialite ✅
- /cgu ✅
- /cgv ✅
- /cookies ✅
- /remboursements ✅
- /contact ✅ (formulaire → contact_messages)
- /securite ✅

### 8.3 Landing page
- 11 sections (NavBar, Hero, Pain Points, Solution, How It Works, Actor Tabs, Proofs, Pricing, FAQ, CTA Final, Footer)
- Animations IntersectionObserver
- Zéro framer-motion, zéro testimonial inventé

### 8.3 SEO
- react-helmet-async installé et HelmetProvider wrappé
- SchemaOrg.tsx : Organization, SoftwareApplication, FAQPage, Article, Breadcrumb, Physician, Pharmacy
- robots.txt : exclusions /patient/, /admin/, /super-admin/, etc.
- sitemap.xml statique + script Deno dynamique (`scripts/generate-sitemap.ts`)
- /pro/:slug et /pharmacie/:slug avec Schema.org

### 8.3.4 Blog
- BlogIndexPage.tsx avec filtres et Schema.org Blog
- BlogArticlePage.tsx avec renderer Markdown custom et Schema.org Article
- 6 articles rédigés en français
- Tunnels de conversion complets

## Scripts

- `scripts/check-routes.ts` — vérifie 38 routes (publiques, auth, admin, super-admin) ✅
- `scripts/generate-sitemap.ts` — génère sitemap.xml dynamique depuis Supabase

## Sécurité du bundle

- Aucune clé secrète réelle dans le bundle ✅
- `IntegrationsPage` contient les labels UI `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, etc. en tant que noms de champs de formulaire (interface de gestion des intégrations super-admin) — pas de valeurs réelles

## Analyse TODO / console.log / mock

- 1 TODO légitime : `TwoFactorPage.tsx:226` — `/* TODO: flux code de secours */` (placeholder UI, non bloquant)
- 0 console.log
- 0 mockData

## Comptes de test

Voir `supabase/seed/report.md`
Mot de passe universel : `00000000` (staging/local uniquement)
