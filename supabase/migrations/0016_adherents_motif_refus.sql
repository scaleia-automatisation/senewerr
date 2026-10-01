-- Stocke le motif de refus sur la ligne adhérent
ALTER TABLE adherents_couverture
  ADD COLUMN IF NOT EXISTS motif_refus text;
