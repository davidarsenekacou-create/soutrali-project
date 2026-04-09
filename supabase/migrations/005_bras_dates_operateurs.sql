-- ============================================
-- MIGRATION 005: Bras, dates membre, multi-opérateurs
-- ============================================

-- 1) MEMBRES : ajouter nombre_bras, date_debut, date_fin
ALTER TABLE membres ADD COLUMN IF NOT EXISTS nombre_bras INTEGER NOT NULL DEFAULT 1;
ALTER TABLE membres ADD COLUMN IF NOT EXISTS date_debut DATE;
ALTER TABLE membres ADD COLUMN IF NOT EXISTS date_fin DATE;

-- 2) COMPTES_TRANSACTION : passer à plusieurs opérateurs
ALTER TABLE comptes_transaction ADD COLUMN IF NOT EXISTS operateurs TEXT[] NOT NULL DEFAULT '{}';

-- Migrer l'ancien operateur (singulier) vers le tableau (si existait)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comptes_transaction' AND column_name = 'operateur'
  ) THEN
    UPDATE comptes_transaction
    SET operateurs = ARRAY[operateur]
    WHERE operateur IS NOT NULL AND (operateurs IS NULL OR array_length(operateurs, 1) IS NULL);
    ALTER TABLE comptes_transaction DROP COLUMN operateur;
  END IF;
END $$;

-- 3) COTISATIONS : tracer l'opérateur utilisé pour le paiement
ALTER TABLE cotisations ADD COLUMN IF NOT EXISTS operateur TEXT;
CREATE INDEX IF NOT EXISTS idx_cotisations_operateur ON cotisations(operateur);
