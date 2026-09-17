# Medikool — Comptes de test BLOC 8

Généré le 2026-09-18

> Mot de passe universel : **`00000000`** (tous les comptes)

---

## Comptes principaux (10)

| # | Email | Nom | Rôle | Organisation | Plan |
|---|-------|-----|------|-------------|------|
| 1 | mousssdembel@gmail.com | Moussa Dembélé | super_admin | — | — |
| 2 | contacts.scale.ia@gmail.com | Scale IA Support | platform_admin | — | — |
| 3 | tropicaddictverdun@gmail.com | Mamadou Diop | patient | — | patient_free |
| 4 | contact.scale.ia@gmail.com | Dr Aminata Ndiaye | professional | Cabinet Ndiaye (cardio) | pro_pro |
| 5 | lifemindsetsucess@gmail.com | Dr Ibrahima Ba | professional | — | pro_free |
| 6 | cestcarrelamarque@gmail.com | Admin Kër Santé | establishment_admin | Clinique Kër Santé | est_centre |
| 7 | ebookproai@gmail.com | Rokhaya Sène | establishment_staff | Clinique Kër Santé | — |
| 8 | pharmaciesconnectes@gmail.com | Admin Pharmacie Liberté | pharmacy_admin | Pharmacie Liberté | pharmacy_start |
| 9 | lemiamsrestaurant@gmail.com | Cheikh Fall | pharmacy_staff | Pharmacie Liberté | — |
| 10 | elitemaagency@gmail.com | Admin Teranga Santé | mutual_admin | Teranga Santé | mutual_pro |

---

## Comptes supplémentaires (8)

| # | Email | Nom | Rôle | Spécialité / Organisation | Plan |
|---|-------|-----|------|--------------------------|------|
| 11 | patient1.test@medikool.test | Fatou Sarr | patient | — | patient_free |
| 12 | patient2.test@medikool.test | Ousmane Diallo | patient | — | patient_free |
| 13 | pro1.test@medikool.test | Dr Mariama Diouf | professional | Pédiatrie | pro_solo |
| 14 | pro2.test@medikool.test | Dr Abdoulaye Sy | professional | Dermatologie | pro_expert |
| 15 | pro3.test@medikool.test | Awa Ndoye | professional | Sage-femme | pro_free |
| 16 | etab1.test@medikool.test | Admin Les Almadies | establishment_admin | Cabinet Médical Les Almadies | est_cabinet |
| 17 | etab2.test@medikool.test | Admin Thiès Santé | establishment_admin | Centre Médical Thiès Santé | est_centre |
| 18 | etab3.test@medikool.test | Admin Espoir | establishment_admin | Clinique Saint-Louis Espoir | est_clinique |

---

## Organisations créées

| Nom | Type DB | Sous-type | Ville | Vérification |
|-----|---------|-----------|-------|-------------|
| Cabinet Ndiaye | establishment | cabinet | Dakar | verified |
| Clinique Kër Santé | establishment | clinique | Dakar | verified |
| Pharmacie Liberté | pharmacy | — | Dakar | verified |
| Teranga Santé | insurance_provider | — | — | verified |
| Cabinet Médical Les Almadies | establishment | cabinet | Dakar | pending |
| Centre Médical Thiès Santé | establishment | centre_medical | Thiès | pending |
| Clinique Saint-Louis Espoir | establishment | clinique | Saint-Louis | pending |

---

## Données de démo

- **12 médicaments** : Doliprane 1000mg, Amoxicilline 500mg, Ibuprofène 400mg, Metformine 500mg, Amlodipine 5mg, Atorvastatine 20mg, Oméprazole 20mg, Cotrimoxazole 480mg, Artemether-Lumefantrine 20/120mg, Acide folique 5mg, Sulfate ferreux 200mg, Vitamine D3 1000UI
- **12 questions FAQ** (catégories : tarifs, patients, confidentialité, mutuelle, professionnels, pharmacie, paiements, établissements, général)
- **6 articles blog** (statut published)

---

## Commandes d'exécution

```bash
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
deno run --allow-env --allow-net C:\medikool\supabase\seed\seed.ts
```

---

## Notes techniques

- Script idempotent : upserts sur conflict partout
- Trigger auth crée le profil automatiquement ; le script met à jour les champs additionnels
- Subscriptions : partial unique indexes gérés par vérification préalable
- Pas de RDV/réservations (dépendances croisées complexes, à faire manuellement)
- FAQ : pas de contrainte unique sur question — doublons ignorés silencieusement
