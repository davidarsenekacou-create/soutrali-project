-- ============================================
-- MIGRATION 007: Permission view.statistiques
-- ============================================

-- Accorder l'accès aux statistiques aux comptes existants qui voient déjà le tableau de bord
UPDATE utilisateurs
SET permissions = array_append(permissions, 'view.statistiques')
WHERE 'view.dashboard' = ANY(permissions)
  AND NOT ('view.statistiques' = ANY(permissions));
