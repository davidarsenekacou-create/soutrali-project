-- ============================================
-- MIGRATION 002: Comptes de transaction & traçabilité
-- ============================================

-- Table: comptes de transaction (numéros Mobile Money, etc.)
CREATE TABLE comptes_transaction (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(255) NOT NULL,
  numero VARCHAR(50) NOT NULL,
  operateur VARCHAR(100),
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajout des colonnes de traçabilité sur cotisations
ALTER TABLE cotisations
  ADD COLUMN compte_transaction_id UUID REFERENCES comptes_transaction(id) ON DELETE SET NULL,
  ADD COLUMN id_transaction VARCHAR(100);

CREATE INDEX idx_cotisations_compte ON cotisations(compte_transaction_id);

-- Mise à jour de la fonction toggle : on ne l'utilise plus pour l'ajout (popup),
-- mais on la garde pour la suppression (décocher)
CREATE OR REPLACE FUNCTION supprimer_cotisation(
  p_membre_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
BEGIN
  DELETE FROM cotisations
  WHERE membre_id = p_membre_id AND date_paiement = p_date;
END;
$$ LANGUAGE plpgsql;
