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
  created_at: string
}

export interface CompteTransaction {
  id: string
  nom: string
  numero: string
  operateur: string | null
  actif: boolean
  created_at: string
}

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
  actif: boolean
  created_at: string
  updated_at: string
}

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
