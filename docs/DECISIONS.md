# DECISIONS — Hypothèses à valider

Liste des hypothèses techniques et légales prises pendant le développement, à confirmer avec l'équipe Medikool avant la mise en production.

## Légales

| # | Hypothèse | Décision par défaut | À valider par |
|---|---|---|---|
| L-01 | Raison sociale exacte de Medikool SAS | "Medikool SAS" | Fondateur |
| L-02 | RCCM Sénégal et NINEA | Non renseignés (pages légales marquées "Hypothèse à valider") | Fondateur |
| L-03 | Nom du directeur de publication | Non renseigné | Fondateur |
| L-04 | Numéro de téléphone | Non renseigné | Fondateur |
| L-05 | Région Supabase la plus proche autorisée | eu-west-1 (Paris) | DPO + Legal |
| L-06 | Audit de sécurité externe — prestataire et planning | "prévu" (page Sécurité) | CTO |
| L-07 | Programme Bug Bounty — plateforme et barème | "à lancer" (page Sécurité) | CTO |

## Techniques

| # | Hypothèse | Décision par défaut | À valider par |
|---|---|---|---|
| T-01 | Domaine production | medikool.sn + app.medikool.sn | Fondateur |
| T-02 | Capacitor iOS/Android — publication App Store/Play Store | Non publiés au MVP | Fondateur |
| T-03 | Stripe région Sénégal — support XOF | Stripe Afrique disponible via Stripe Atlas | CTO + Stripe account |
| T-04 | Wave et Orange Money — accès API production | Accès sandbox disponible ; production à demander | CTO |
| T-05 | hCaptcha site key | Non configurée (placeholder dans Contact.tsx) | Ops |
| T-06 | PostHog EU region | eu.posthog.com (conforme RGPD) | DPO |
| T-07 | VAPID keys pour Web Push | À générer avec `web-push generate-vapid-keys` | Ops |
| T-08 | pg_cron en production Supabase | Disponible sur plan Pro+ | CTO |

## Métier

| # | Hypothèse | Décision par défaut | À valider par |
|---|---|---|---|
| M-01 | Taux de change USD→XOF dans platform_settings | 620 (valeur seedée) | Finance |
| M-02 | Plafond de remboursement admin (50 000 FCFA) | 50 000 FCFA par opération | Fondateur |
| M-03 | Durée de validité ordonnance | 90 jours (standard OMS) | Dr Ndiaye ou conseil médical |
| M-04 | Timeout partage ordonnance pharmacie | 48h révocable | Conseil médical |
| M-05 | Commission Pharmacie Liberté (pharmacy_start) | 5%, plafond 5 000 FCFA | Fondateur |
| M-06 | Essai gratuit établissements/mutuelles | 14 jours | Fondateur |
