-- ============================================
-- MIGRATION 003: Utilisateurs, rôles et gérantes
-- ============================================

-- Table: utilisateurs (admin et gérantes)
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(255) NOT NULL,
  login VARCHAR(100) NOT NULL UNIQUE,
  mot_de_passe TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'responsable', 'gerante')),
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_utilisateurs_updated_at
  BEFORE UPDATE ON utilisateurs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Table: attribution des gérantes aux tontines
CREATE TABLE tontine_gerantes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tontine_id UUID NOT NULL REFERENCES tontines(id) ON DELETE CASCADE,
  utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tontine_gerante UNIQUE (tontine_id, utilisateur_id)
);

CREATE INDEX idx_tontine_gerantes_tontine ON tontine_gerantes(tontine_id);
CREATE INDEX idx_tontine_gerantes_utilisateur ON tontine_gerantes(utilisateur_id);

-- Créer un compte admin par défaut (mot de passe: admin123)
-- Le hash SHA-256 de "admin123" est précalculé
INSERT INTO utilisateurs (nom, login, mot_de_passe, role)
VALUES ('Administrateur', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin');
