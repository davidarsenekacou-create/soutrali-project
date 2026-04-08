-- ============================================
-- MIGRATION 004: Prises v2
-- ============================================

-- 1) Supprimer la contrainte "une seule prise par mois" pour permettre plusieurs preneurs
ALTER TABLE prises DROP CONSTRAINT IF EXISTS uq_prise_tontine_mois;

-- 2) Ajouter les nouvelles colonnes à prises
ALTER TABLE prises ADD COLUMN IF NOT EXISTS periode VARCHAR(100);
ALTER TABLE prises ADD COLUMN IF NOT EXISTS documents_fournis TEXT[] DEFAULT '{}';

-- 3) Renommer montant_total en montant (si pas déjà fait)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prises' AND column_name = 'montant_total') THEN
    ALTER TABLE prises RENAME COLUMN montant_total TO montant;
  END IF;
END $$;
