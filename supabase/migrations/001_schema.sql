-- ============================================
-- SOUTRALI BENEDICTION - Schéma de base de données
-- Plateforme de gestion de tontines
-- ============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: tontines
-- Représente un groupe de tontine
-- ============================================
CREATE TABLE tontines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  montant_journalier NUMERIC(12, 0) NOT NULL DEFAULT 2750,
  devise VARCHAR(10) NOT NULL DEFAULT 'FCFA',
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: membres
-- Les participants d'une tontine
-- ============================================
CREATE TABLE membres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tontine_id UUID NOT NULL REFERENCES tontines(id) ON DELETE CASCADE,
  nom VARCHAR(255) NOT NULL,
  contact VARCHAR(50),
  numero_ordre INTEGER,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_membres_tontine ON membres(tontine_id);

-- ============================================
-- TABLE: cotisations
-- Paiements journaliers des membres
-- ============================================
CREATE TABLE cotisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tontine_id UUID NOT NULL REFERENCES tontines(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  date_paiement DATE NOT NULL,
  montant NUMERIC(12, 0) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cotisation_membre_date UNIQUE (membre_id, date_paiement)
);

CREATE INDEX idx_cotisations_tontine ON cotisations(tontine_id);
CREATE INDEX idx_cotisations_membre ON cotisations(membre_id);
CREATE INDEX idx_cotisations_date ON cotisations(date_paiement);

-- ============================================
-- TABLE: prises
-- Attribution de la cagnotte mensuelle
-- Un seul membre reçoit le pot par mois
-- ============================================
CREATE TABLE prises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tontine_id UUID NOT NULL REFERENCES tontines(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  mois SMALLINT NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee SMALLINT NOT NULL CHECK (annee BETWEEN 2020 AND 2100),
  montant_total NUMERIC(12, 0),
  date_prise DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_prise_tontine_mois UNIQUE (tontine_id, mois, annee)
);

CREATE INDEX idx_prises_tontine ON prises(tontine_id);
CREATE INDEX idx_prises_membre ON prises(membre_id);

-- ============================================
-- VUES utilitaires
-- ============================================

-- Vue: résumé mensuel par membre
CREATE OR REPLACE VIEW vue_cotisations_mensuelles AS
SELECT
  c.tontine_id,
  c.membre_id,
  m.nom AS membre_nom,
  m.contact AS membre_contact,
  EXTRACT(MONTH FROM c.date_paiement)::INT AS mois,
  EXTRACT(YEAR FROM c.date_paiement)::INT AS annee,
  COUNT(*) AS jours_payes,
  SUM(c.montant) AS total_cotise
FROM cotisations c
JOIN membres m ON m.id = c.membre_id
GROUP BY c.tontine_id, c.membre_id, m.nom, m.contact,
         EXTRACT(MONTH FROM c.date_paiement),
         EXTRACT(YEAR FROM c.date_paiement);

-- Vue: total collecté par mois par tontine
CREATE OR REPLACE VIEW vue_totaux_mensuels AS
SELECT
  c.tontine_id,
  t.nom AS tontine_nom,
  EXTRACT(MONTH FROM c.date_paiement)::INT AS mois,
  EXTRACT(YEAR FROM c.date_paiement)::INT AS annee,
  COUNT(DISTINCT c.membre_id) AS membres_actifs,
  COUNT(*) AS total_paiements,
  SUM(c.montant) AS total_collecte
FROM cotisations c
JOIN tontines t ON t.id = c.tontine_id
GROUP BY c.tontine_id, t.nom,
         EXTRACT(MONTH FROM c.date_paiement),
         EXTRACT(YEAR FROM c.date_paiement);

-- ============================================
-- FONCTIONS RPC
-- ============================================

-- Fonction: obtenir la grille de cotisations d'un mois
CREATE OR REPLACE FUNCTION get_grille_cotisations(
  p_tontine_id UUID,
  p_mois INT,
  p_annee INT
)
RETURNS TABLE (
  membre_id UUID,
  membre_nom VARCHAR,
  membre_contact VARCHAR,
  numero_ordre INT,
  jour INT,
  paye BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS membre_id,
    m.nom AS membre_nom,
    m.contact AS membre_contact,
    m.numero_ordre,
    EXTRACT(DAY FROM c.date_paiement)::INT AS jour,
    TRUE AS paye
  FROM membres m
  LEFT JOIN cotisations c ON c.membre_id = m.id
    AND EXTRACT(MONTH FROM c.date_paiement) = p_mois
    AND EXTRACT(YEAR FROM c.date_paiement) = p_annee
  WHERE m.tontine_id = p_tontine_id
    AND m.actif = TRUE
  ORDER BY m.numero_ordre, m.nom;
END;
$$ LANGUAGE plpgsql;

-- Fonction: basculer le paiement d'un jour (toggle)
CREATE OR REPLACE FUNCTION toggle_cotisation(
  p_tontine_id UUID,
  p_membre_id UUID,
  p_date DATE,
  p_montant NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM cotisations
    WHERE membre_id = p_membre_id AND date_paiement = p_date
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM cotisations
    WHERE membre_id = p_membre_id AND date_paiement = p_date;
    RETURN FALSE;
  ELSE
    INSERT INTO cotisations (tontine_id, membre_id, date_paiement, montant)
    VALUES (p_tontine_id, p_membre_id, p_date, p_montant);
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonction: statistiques dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_tontine_id UUID)
RETURNS TABLE (
  total_membres BIGINT,
  total_collecte_global NUMERIC,
  total_prises BIGINT,
  mois_courant_collecte NUMERIC,
  mois_courant_paiements BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM membres WHERE tontine_id = p_tontine_id AND actif = TRUE),
    (SELECT COALESCE(SUM(montant), 0) FROM cotisations WHERE tontine_id = p_tontine_id),
    (SELECT COUNT(*) FROM prises WHERE tontine_id = p_tontine_id),
    (SELECT COALESCE(SUM(montant), 0) FROM cotisations
     WHERE tontine_id = p_tontine_id
       AND EXTRACT(MONTH FROM date_paiement) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM date_paiement) = EXTRACT(YEAR FROM CURRENT_DATE)),
    (SELECT COUNT(*) FROM cotisations
     WHERE tontine_id = p_tontine_id
       AND EXTRACT(MONTH FROM date_paiement) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM date_paiement) = EXTRACT(YEAR FROM CURRENT_DATE));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- À activer après configuration de l'auth
-- ============================================
-- ALTER TABLE tontines ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE membres ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cotisations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prises ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_tontines_updated_at
  BEFORE UPDATE ON tontines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_membres_updated_at
  BEFORE UPDATE ON membres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
