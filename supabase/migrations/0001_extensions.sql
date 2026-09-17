-- ============================================================
-- 0001_extensions.sql — Extensions PostgreSQL requises
-- ============================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Géospatial (recherche par proximité)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Chiffrement colonne (pgsodium pour secrets comme 2FA)
CREATE EXTENSION IF NOT EXISTS "pgsodium";

-- Recherche full-text en français
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Tâches planifiées
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Case-insensitive text
CREATE EXTENSION IF NOT EXISTS "citext";

-- Statistiques avancées (optionnel, monitoring)
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;

-- ============================================================
-- Schéma privé pour les fonctions SECURITY DEFINER
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- ============================================================
-- Trigger générique : updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
