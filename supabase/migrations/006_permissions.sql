-- ============================================
-- MIGRATION 006: Permissions granulaires par utilisateur
-- ============================================

ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- Valeurs par défaut sensibles selon le rôle existant
-- Responsable : lecture seule sur tous les onglets
UPDATE utilisateurs
SET permissions = ARRAY[
  'view.dashboard', 'view.tontines', 'view.comptes', 'view.gerantes'
]
WHERE role = 'responsable' AND (permissions IS NULL OR array_length(permissions, 1) IS NULL);

-- Gérante : voir ses tontines et cocher paiements + créer prises
UPDATE utilisateurs
SET permissions = ARRAY[
  'view.tontines', 'cotisations.cocher', 'prises.create'
]
WHERE role = 'gerante' AND (permissions IS NULL OR array_length(permissions, 1) IS NULL);
