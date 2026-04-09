export interface Tontine {
  id: string
  nom: string
  description: string | null
  montant_journalier: number
  devise: string
  date_debut: string
  date_fin: string
  actif: boolean
  created_at: string
  updated_at: string
}

export interface Membre {
  id: string
  tontine_id: string
  nom: string
  contact: string | null
  numero_ordre: number | null
  nombre_bras: number
  date_debut: string | null
  date_fin: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface Cotisation {
  id: string
  tontine_id: string
  membre_id: string
  date_paiement: string
  montant: number
  compte_transaction_id: string | null
  id_transaction: string | null
  operateur: string | null
  created_at: string
}

export interface CompteTransaction {
  id: string
  nom: string
  numero: string
  operateurs: string[]
  actif: boolean
  created_at: string
}

export const OPERATEURS_DISPONIBLES = [
  'Orange Money',
  'MTN Mobile Money',
  'Moov Money',
  'Wave',
  'Autre',
]

export interface Prise {
  id: string
  tontine_id: string
  membre_id: string
  mois: number
  annee: number
  montant: number | null
  date_prise: string | null
  periode: string | null
  documents_fournis: string[]
  note: string | null
  created_at: string
}

export const DOCUMENTS_PRISE = [
  'CNI',
  'Passeport',
  'Permis',
  'Certificat de résidence',
  'CNI et Contact personne référente',
  'Procuration',
  'Attestation',
  'Autre',
]

export interface DashboardStats {
  total_membres: number
  total_collecte_global: number
  total_prises: number
  mois_courant_collecte: number
  mois_courant_paiements: number
}

export interface MembreCotisationMensuelle {
  membre_id: string
  membre_nom: string
  membre_contact: string | null
  numero_ordre: number | null
  jours_payes: Set<number>
  total: number
  a_pris: boolean
}

export interface Utilisateur {
  id: string
  nom: string
  login: string
  role: 'admin' | 'responsable' | 'gerante'
  permissions: string[]
  actif: boolean
  created_at: string
  updated_at: string
}

// Liste exhaustive des permissions disponibles, groupées par section
export interface PermissionDef {
  key: string
  label: string
}

export interface PermissionGroup {
  titre: string
  permissions: PermissionDef[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    titre: 'Onglets visibles',
    permissions: [
      { key: 'view.dashboard', label: 'Voir le tableau de bord' },
      { key: 'view.tontines', label: 'Voir l\'onglet Tontines' },
      { key: 'view.comptes', label: 'Voir l\'onglet Comptes' },
      { key: 'view.gerantes', label: 'Voir l\'onglet Gestion des comptes' },
      { key: 'view.statistiques', label: 'Voir l\'onglet Statistiques' },
    ],
  },
  {
    titre: 'Tontines',
    permissions: [
      { key: 'tontines.create', label: 'Créer une tontine' },
      { key: 'tontines.edit', label: 'Modifier une tontine' },
      { key: 'tontines.delete', label: 'Supprimer une tontine' },
    ],
  },
  {
    titre: 'Membres',
    permissions: [
      { key: 'membres.create', label: 'Ajouter un membre' },
      { key: 'membres.edit', label: 'Modifier un membre' },
      { key: 'membres.toggle', label: 'Activer / désactiver un membre' },
      { key: 'membres.delete', label: 'Supprimer un membre' },
    ],
  },
  {
    titre: 'Cotisations',
    permissions: [
      { key: 'cotisations.cocher', label: 'Cocher un paiement' },
      { key: 'cotisations.decocher', label: 'Décocher un paiement' },
    ],
  },
  {
    titre: 'Prises',
    permissions: [
      { key: 'prises.create', label: 'Attribuer une prise' },
      { key: 'prises.delete', label: 'Retirer une prise' },
    ],
  },
  {
    titre: 'Comptes de transaction',
    permissions: [
      { key: 'comptes.create', label: 'Ajouter un compte' },
      { key: 'comptes.edit', label: 'Modifier / désactiver un compte' },
      { key: 'comptes.delete', label: 'Supprimer un compte' },
    ],
  },
]

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key))

export interface TontineGerante {
  id: string
  tontine_id: string
  utilisateur_id: string
  created_at: string
}

export const MOIS_NOMS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

export function joursParMois(mois: number, annee: number): number {
  return new Date(annee, mois, 0).getDate()
}

export function formatMontant(montant: number, devise = 'FCFA'): string {
  return `${montant.toLocaleString('fr-FR')} ${devise}`
}
