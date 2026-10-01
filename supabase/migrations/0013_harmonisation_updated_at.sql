-- ═══════════════════════════════════════════════════════════════════════════
-- SÉNÉ WÉRR — Harmonisation updated_at sur toutes les tables mutables
-- ═══════════════════════════════════════════════════════════════════════════
-- La fonction set_updated_at() est déjà définie dans 0006_triggers.sql.
-- Après renommage 0012, les triggers postgres suivent automatiquement la table ;
-- on ajoute ici les triggers manquants et les colonnes manquantes.

-- ─── 1. Triggers manquants sur tables qui ont DÉJÀ updated_at ────────────────

-- beneficiaires
create trigger trg_beneficiaires_updated_at
  before update on beneficiaires
  for each row execute function set_updated_at();

-- formules_couverture
create trigger trg_formules_couverture_updated_at
  before update on formules_couverture
  for each row execute function set_updated_at();

-- adherents_couverture
create trigger trg_adherents_couverture_updated_at
  before update on adherents_couverture
  for each row execute function set_updated_at();

-- dossiers_medicaux
create trigger trg_dossiers_medicaux_updated_at
  before update on dossiers_medicaux
  for each row execute function set_updated_at();

-- produits_pharmacie
create trigger trg_produits_pharmacie_updated_at
  before update on produits_pharmacie
  for each row execute function set_updated_at();

-- avis
create trigger trg_avis_updated_at
  before update on avis
  for each row execute function set_updated_at();

-- grilles_tarifs
create trigger trg_grilles_tarifs_updated_at
  before update on grilles_tarifs
  for each row execute function set_updated_at();

-- ─── 2. Ajout updated_at + trigger sur 14 tables mutables ────────────────────

-- consentements
alter table consentements
  add column if not exists updated_at timestamptz default now();
create trigger trg_consentements_updated_at
  before update on consentements
  for each row execute function set_updated_at();

-- qualifications_professionnelles
alter table qualifications_professionnelles
  add column if not exists updated_at timestamptz default now();
create trigger trg_qualifications_pro_updated_at
  before update on qualifications_professionnelles
  for each row execute function set_updated_at();

-- services_etablissement
alter table services_etablissement
  add column if not exists updated_at timestamptz default now();
create trigger trg_services_etab_updated_at
  before update on services_etablissement
  for each row execute function set_updated_at();

-- affiliations_etablissement
alter table affiliations_etablissement
  add column if not exists updated_at timestamptz default now();
create trigger trg_affiliations_etab_updated_at
  before update on affiliations_etablissement
  for each row execute function set_updated_at();

-- regles_couverture
alter table regles_couverture
  add column if not exists updated_at timestamptz default now();
create trigger trg_regles_couverture_updated_at
  before update on regles_couverture
  for each row execute function set_updated_at();

-- factures
alter table factures
  add column if not exists updated_at timestamptz default now();
create trigger trg_factures_updated_at
  before update on factures
  for each row execute function set_updated_at();

-- remboursements
alter table remboursements
  add column if not exists updated_at timestamptz default now();
create trigger trg_remboursements_updated_at
  before update on remboursements
  for each row execute function set_updated_at();

-- notifications
alter table notifications
  add column if not exists updated_at timestamptz default now();
create trigger trg_notifications_updated_at
  before update on notifications
  for each row execute function set_updated_at();

-- reponses_avis
alter table reponses_avis
  add column if not exists updated_at timestamptz default now();
create trigger trg_reponses_avis_updated_at
  before update on reponses_avis
  for each row execute function set_updated_at();

-- teleconsultation_sessions
alter table teleconsultation_sessions
  add column if not exists updated_at timestamptz default now();
create trigger trg_teleconsult_updated_at
  before update on teleconsultation_sessions
  for each row execute function set_updated_at();

-- entrees_dossiers
alter table entrees_dossiers
  add column if not exists updated_at timestamptz default now();
create trigger trg_entrees_dossiers_updated_at
  before update on entrees_dossiers
  for each row execute function set_updated_at();

-- articles_ordonnance
alter table articles_ordonnance
  add column if not exists updated_at timestamptz default now();
create trigger trg_articles_ordonnance_updated_at
  before update on articles_ordonnance
  for each row execute function set_updated_at();

-- articles_reservation
alter table articles_reservation
  add column if not exists updated_at timestamptz default now();
create trigger trg_articles_reservation_updated_at
  before update on articles_reservation
  for each row execute function set_updated_at();

-- specialites_professionnelles
alter table specialites_professionnelles
  add column if not exists updated_at timestamptz default now();
create trigger trg_specialites_pro_updated_at
  before update on specialites_professionnelles
  for each row execute function set_updated_at();

-- ─── 3. created_at manquant sur parametres_plateforme et drapeaux_fonctionnalites
alter table parametres_plateforme
  add column if not exists created_at timestamptz default now();
alter table drapeaux_fonctionnalites
  add column if not exists created_at timestamptz default now();

-- ─── 4. demandes_couverture — colonnes dupliquées ────────────────────────────
-- Le trigger sync_coverage_amounts (0010_schema_corrections.sql) maintient
-- la cohérence entre les deux jeux de colonnes :
--   total_amount_fcfa  ↔  amount_total
--   coverage_amount_fcfa  ↔  amount_covered
--   patient_amount_fcfa   ↔  amount_patient
--   reviewed_at  ↔  decided_at
--   admin_notes  ↔  decision_notes
--   additional_docs_requested  ↔  required_documents
-- Les deux nomenclatures sont utilisées dans le code ; aucune colonne n'est supprimée.
-- Le trigger assure la synchronisation bidirectionnelle à chaque INSERT/UPDATE.
