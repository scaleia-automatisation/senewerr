-- Ajout colonne statut sur adherents_couverture
-- Valeurs : 'en_attente' (déclaration patient non validée), 'actif', 'refuse'

ALTER TABLE adherents_couverture
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'en_attente'
  CHECK (statut IN ('en_attente', 'actif', 'refuse'));

-- Les adhérences déjà is_active = true → 'actif'
UPDATE adherents_couverture SET statut = 'actif' WHERE is_active = true;
