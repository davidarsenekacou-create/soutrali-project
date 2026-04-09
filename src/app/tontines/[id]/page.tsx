'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Tontine, Membre, Prise, CompteTransaction, MOIS_NOMS, joursParMois, formatMontant, DOCUMENTS_PRISE } from '@/lib/types'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'

interface MembreAvecCotisations {
  membre: Membre
  paiements: Map<number, { compte_transaction_id: string | null; id_transaction: string | null; operateur: string | null }>
  total: number
  prises: Prise[]
}

interface PopupState {
  membreId: string
  membreNom: string
  jour: number
  compteId: string
  operateur: string
  idTransaction: string
  nbJours: number
}

interface PrisePopupState {
  membreId: string
  membreNom: string
  datePrise: string
  montant: string
  periode: string
  documents: string[]
  prisesExistantes: Prise[]
}

interface MoisItem {
  mois: number
  annee: number
  label: string
}

function getMonthsInRange(dateDebut: string, dateFin: string): MoisItem[] {
  const months: MoisItem[] = []
  const start = new Date(dateDebut)
  const end = new Date(dateFin)
  let current = new Date(start.getFullYear(), start.getMonth(), 1)

  while (current <= end) {
    const m = current.getMonth() + 1
    const a = current.getFullYear()
    months.push({ mois: m, annee: a, label: `${MOIS_NOMS[m].substring(0, 3)} ${a}` })
    current.setMonth(current.getMonth() + 1)
  }
  return months
}

export default function TontineDetailPage() {
  const params = useParams()
  const tontineId = params.id as string
  const { isResponsable, utilisateur, hasPermission } = useAuth()
  const isGerante = utilisateur?.role === 'gerante'
  const peutCocher = hasPermission('cotisations.cocher')
  const peutDecocher = hasPermission('cotisations.decocher')
  const peutCreerPrise = hasPermission('prises.create')
  const peutSupprimerPrise = hasPermission('prises.delete')

  const [tontine, setTontine] = useState<Tontine | null>(null)
  const [grille, setGrille] = useState<MembreAvecCotisations[]>([])
  const [comptes, setComptes] = useState<CompteTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Popup de paiement
  const [popup, setPopup] = useState<PopupState | null>(null)

  // Popup de prise
  const [prisePopup, setPrisePopup] = useState<PrisePopupState | null>(null)

  // Mois/année sélectionnés
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [moisDisponibles, setMoisDisponibles] = useState<MoisItem[]>([])

  const nbJours = joursParMois(mois, annee)

  const loadData = useCallback(async () => {
    try {
      const { data: t } = await supabase
        .from('tontines')
        .select('*')
        .eq('id', tontineId)
        .single()

      if (!t) return

      // Calculer les mois disponibles depuis la période de la tontine
      const months = getMonthsInRange(t.date_debut, t.date_fin)
      setMoisDisponibles(months)

      // Si le mois actuel n'est pas dans la plage, sélectionner le premier
      const currentInRange = months.find((m) => m.mois === mois && m.annee === annee)
      if (!currentInRange && months.length > 0) {
        // Trouver le mois le plus proche du mois actuel
        const now = new Date()
        const closest = months.reduce((prev, curr) => {
          const prevDiff = Math.abs(new Date(prev.annee, prev.mois - 1).getTime() - now.getTime())
          const currDiff = Math.abs(new Date(curr.annee, curr.mois - 1).getTime() - now.getTime())
          return currDiff < prevDiff ? curr : prev
        })
        setMois(closest.mois)
        setAnnee(closest.annee)
        setTontine(t)
        return // loadData sera rappelé par le changement de mois/annee
      }

      const currentNbJours = joursParMois(mois, annee)

      const [{ data: m }, { data: c }, { data: p }, { data: cpt }] = await Promise.all([
        supabase
          .from('membres')
          .select('*')
          .eq('tontine_id', tontineId)
          .eq('actif', true)
          .order('numero_ordre', { ascending: true })
          .order('nom', { ascending: true }),
        supabase
          .from('cotisations')
          .select('*')
          .eq('tontine_id', tontineId)
          .gte('date_paiement', `${annee}-${String(mois).padStart(2, '0')}-01`)
          .lte('date_paiement', `${annee}-${String(mois).padStart(2, '0')}-${String(currentNbJours).padStart(2, '0')}`),
        supabase
          .from('prises')
          .select('*')
          .eq('tontine_id', tontineId),
        supabase
          .from('comptes_transaction')
          .select('*')
          .eq('actif', true)
          .order('nom'),
      ])

      setTontine(t)
      setComptes(cpt || [])

      const membresData = m || []
      const cotisData = c || []
      const prisesData = p || []

      const grilleData: MembreAvecCotisations[] = membresData.map((membre) => {
        const paiementsMembre = cotisData.filter((cot) => cot.membre_id === membre.id)
        const paiementsMap = new Map<number, { compte_transaction_id: string | null; id_transaction: string | null; operateur: string | null }>()
        paiementsMembre.forEach((cot) => {
          const jour = new Date(cot.date_paiement).getDate()
          paiementsMap.set(jour, {
            compte_transaction_id: cot.compte_transaction_id,
            id_transaction: cot.id_transaction,
            operateur: cot.operateur || null,
          })
        })
        const total = paiementsMap.size * t.montant_journalier
        const membrePrises = prisesData.filter((pr) => pr.membre_id === membre.id)

        return { membre, paiements: paiementsMap, total, prises: membrePrises }
      })

      setGrille(grilleData)
    } catch (error) {
      console.error('Erreur chargement:', error)
    } finally {
      setLoading(false)
    }
  }, [tontineId, mois, annee])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Ouvrir la popup pour cocher un paiement
  function ouvrirPopup(membreId: string, membreNom: string, jour: number) {
    const compteParDefaut = comptes.length > 0 ? comptes[0] : null
    setPopup({
      membreId,
      membreNom,
      jour,
      compteId: compteParDefaut?.id || '',
      operateur: compteParDefaut && compteParDefaut.operateurs && compteParDefaut.operateurs.length === 1 ? compteParDefaut.operateurs[0] : '',
      idTransaction: '',
      nbJours: 1,
    })
  }

  // Quand on change le compte dans la popup, réinitialiser ou auto-sélectionner l'opérateur
  function changerCompteDansPopup(compteId: string) {
    if (!popup) return
    const compte = comptes.find((c) => c.id === compteId)
    const ops = compte?.operateurs || []
    setPopup({
      ...popup,
      compteId,
      operateur: ops.length === 1 ? ops[0] : '',
    })
  }

  // Vérifier si une date est dans la plage active d'un membre
  function membreActifLeJour(membre: Membre, jour: number): boolean {
    if (!tontine) return false
    const dateStr = `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
    const debut = membre.date_debut || tontine.date_debut
    const fin = membre.date_fin || tontine.date_fin
    return dateStr >= debut && dateStr <= fin
  }

  // Confirmer le paiement via popup
  async function confirmerPaiement() {
    if (!popup || !tontine) return

    // Vérifier opérateur si le compte en a plusieurs
    const compteSel = comptes.find((c) => c.id === popup.compteId)
    const ops = compteSel?.operateurs || []
    if (ops.length > 1 && !popup.operateur) {
      toast.error('Veuillez sélectionner l\'opérateur utilisé')
      return
    }

    // Vérifier unicité de l'ID transaction
    if (popup.idTransaction.trim()) {
      const { data: existing } = await supabase
        .from('cotisations')
        .select('id')
        .eq('id_transaction', popup.idTransaction.trim())
        .limit(1)

      if (existing && existing.length > 0) {
        toast.error('Cet ID de transaction existe déjà. Veuillez en saisir un autre.')
        return
      }
    }

    setSaving(true)

    try {
      const inserts = []
      const joursCoches: number[] = []

      for (let i = 0; i < popup.nbJours; i++) {
        const jour = popup.jour + i
        if (jour > nbJours) break

        const item = grille.find((g) => g.membre.id === popup.membreId)
        if (item?.paiements.has(jour)) continue
        if (item && !membreActifLeJour(item.membre, jour)) continue

        const dateStr = `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
        inserts.push({
          tontine_id: tontineId,
          membre_id: popup.membreId,
          date_paiement: dateStr,
          montant: tontine.montant_journalier,
          compte_transaction_id: popup.compteId || null,
          id_transaction: popup.idTransaction.trim() || null,
          operateur: popup.operateur || null,
        })
        joursCoches.push(jour)
      }

      if (inserts.length === 0) {
        toast.error('Tous ces jours sont déjà payés')
        setPopup(null)
        setSaving(false)
        return
      }

      const { error } = await supabase.from('cotisations').insert(inserts)
      if (error) throw error

      // Mise à jour optimiste
      setGrille((prev) =>
        prev.map((item) => {
          if (item.membre.id !== popup.membreId) return item
          const newPaiements = new Map(item.paiements)
          joursCoches.forEach((jour) => {
            newPaiements.set(jour, {
              compte_transaction_id: popup.compteId || null,
              id_transaction: popup.idTransaction.trim() || null,
              operateur: popup.operateur || null,
            })
          })
          return {
            ...item,
            paiements: newPaiements,
            total: newPaiements.size * tontine.montant_journalier,
          }
        })
      )

      setPopup(null)
      toast.success(`${joursCoches.length} jour(s) enregistré(s)`)
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  // Décocher un paiement
  async function decocherPaiement(membreId: string, jour: number) {
    if (!tontine) return

    if (!peutDecocher) {
      toast.error('Vous n\'avez pas la permission de retirer un paiement. Veuillez contacter l\'administrateur.')
      return
    }

    if (!confirm('Retirer ce paiement ?')) return
    setSaving(true)

    const dateStr = `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`

    try {
      const { error } = await supabase
        .from('cotisations')
        .delete()
        .eq('membre_id', membreId)
        .eq('date_paiement', dateStr)

      if (error) throw error

      setGrille((prev) =>
        prev.map((item) => {
          if (item.membre.id !== membreId) return item
          const newPaiements = new Map(item.paiements)
          newPaiements.delete(jour)
          return {
            ...item,
            paiements: newPaiements,
            total: newPaiements.size * tontine.montant_journalier,
          }
        })
      )

      toast.success('Paiement retiré')
    } catch (error: any) {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  // Ouvrir popup prise
  function ouvrirPrisePopup(membreId: string, membreNom: string) {
    const existantes = grille.find((g) => g.membre.id === membreId)?.prises || []
    setPrisePopup({
      membreId,
      membreNom,
      datePrise: new Date().toISOString().split('T')[0],
      montant: '',
      periode: `${MOIS_NOMS[mois]} ${annee}`,
      documents: [],
      prisesExistantes: existantes,
    })
  }

  // Confirmer une prise
  async function confirmerPrise() {
    if (!prisePopup) return

    // Vérifier que le membre n'a pas dépassé son nombre de bras
    const item = grille.find((g) => g.membre.id === prisePopup.membreId)
    if (item) {
      const nbBras = item.membre.nombre_bras || 1
      if (item.prises.length >= nbBras) {
        toast.error(`Ce membre a déjà utilisé ses ${nbBras} bras`)
        return
      }
    }

    setSaving(true)

    try {
      const { error } = await supabase.from('prises').insert({
        tontine_id: tontineId,
        membre_id: prisePopup.membreId,
        mois,
        annee,
        montant: prisePopup.montant ? Number(prisePopup.montant) : null,
        date_prise: prisePopup.datePrise,
        periode: prisePopup.periode || null,
        documents_fournis: prisePopup.documents,
      })

      if (error) throw error
      toast.success(`Prise attribuée à ${prisePopup.membreNom}`)
      setPrisePopup(null)
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Erreur attribution')
    } finally {
      setSaving(false)
    }
  }

  // Supprimer une prise
  async function supprimerPrise(priseId: string) {
    if (!confirm('Retirer cette prise ?')) return
    try {
      await supabase.from('prises').delete().eq('id', priseId)
      toast.success('Prise retirée')
      setPrisePopup(null)
      loadData()
    } catch { toast.error('Erreur') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!tontine) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Tontine introuvable</p>
        <Link href="/tontines" className="btn-primary mt-4 inline-block">Retour</Link>
      </div>
    )
  }

  const totalMois = grille.reduce((sum, item) => sum + item.total, 0)
  const prisesDuMois = grille.flatMap((g) =>
    g.prises.filter((p) => p.mois === mois && p.annee === annee).map((p) => ({
      ...p,
      membreNom: g.membre.nom,
    }))
  )

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6">
        <Link href="/tontines" className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block">
          &larr; Retour aux tontines
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{tontine.nom}</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              {formatMontant(tontine.montant_journalier)} / jour
              {' — '}
              {new Date(tontine.date_debut).toLocaleDateString('fr-FR')} au{' '}
              {new Date(tontine.date_fin).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <Link href={`/tontines/${tontineId}/membres`} className="btn-secondary text-xs sm:text-sm self-start sm:self-auto">
            Gestion membres
          </Link>
        </div>
      </div>

      {/* Barre de période - Mois de la tontine */}
      <div className="card mb-6 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            {moisDisponibles.map((m) => {
              const isActive = m.mois === mois && m.annee === annee
              return (
                <button
                  key={`${m.annee}-${m.mois}`}
                  onClick={() => { setMois(m.mois); setAnnee(m.annee) }}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary-600 text-primary-700 bg-primary-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Stats du mois */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-base sm:text-lg font-bold text-gray-900">
            {MOIS_NOMS[mois]} {annee}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
            <div>
              <span className="text-gray-500">Collecté : </span>
              <span className="font-bold text-primary-700">{formatMontant(totalMois)}</span>
            </div>
            <div>
              <span className="text-gray-500">Membres : </span>
              <span className="font-bold">{grille.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Prises : </span>
              {prisesDuMois.length > 0 ? (
                <span className="font-bold text-success-700">
                  {prisesDuMois.map((p) => p.membreNom).join(', ')}
                </span>
              ) : (
                <span className="text-gray-400">Aucune</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grille de cotisations */}
      {grille.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">Aucun membre dans cette tontine</p>
          <Link href={`/tontines/${tontineId}/membres`} className="btn-primary">Ajouter des membres</Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-semibold text-gray-700 min-w-[180px]">
                    Membre
                  </th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[60px]">
                    PRISE
                  </th>
                  {Array.from({ length: nbJours }, (_, i) => i + 1).map((jour) => (
                    <th key={jour} className="px-1 py-2 text-center font-semibold text-gray-700 min-w-[32px]">
                      {jour}
                    </th>
                  ))}
                  <th className="sticky right-0 bg-gray-50 z-10 px-3 py-2 text-right font-semibold text-gray-700 min-w-[100px]">
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {grille.map((item, idx) => {
                  const isEven = idx % 2 === 0
                  const hasPriseCeMois = item.prises.some((p) => p.mois === mois && p.annee === annee)

                  return (
                    <tr key={item.membre.id} className={`border-b ${isEven ? 'bg-white' : 'bg-gray-50/50'} hover:bg-primary-50/30`}>
                      {/* Nom */}
                      <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium text-gray-900 ${isEven ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="truncate max-w-[140px]" title={item.membre.nom}>
                            {item.membre.nom}
                          </span>
                          {item.membre.contact && (
                            <span className="text-[10px] text-gray-400 ml-1">{item.membre.contact}</span>
                          )}
                        </div>
                      </td>

                      {/* PRISE */}
                      <td className="px-2 py-1.5 text-center">
                        {(() => {
                          const nbBras = item.membre.nombre_bras || 1
                          const nbPrisesTotal = item.prises.length
                          const peutEncorePrendre = nbPrisesTotal < nbBras
                          const label = nbBras > 1 ? `${nbPrisesTotal}/${nbBras}` : ''
                          if (nbPrisesTotal > 0) {
                            return (
                              <button
                                onClick={() => ouvrirPrisePopup(item.membre.id, item.membre.nom)}
                                className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-success-500 text-white cursor-pointer hover:bg-success-600 text-[10px] font-bold gap-1"
                                title={`${nbPrisesTotal} prise(s) sur ${nbBras} bras`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                                {label}
                              </button>
                            )
                          }
                          if (peutCreerPrise && peutEncorePrendre) {
                            return (
                              <button
                                onClick={() => ouvrirPrisePopup(item.membre.id, item.membre.nom)}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400 hover:bg-warning-100 hover:text-warning-600 text-[10px] transition-colors"
                                title={`Attribuer une prise à ${item.membre.nom}${nbBras > 1 ? ` (${nbBras} bras)` : ''}`}
                              >
                                -
                              </button>
                            )
                          }
                          return <span className="text-gray-300">-</span>
                        })()}
                      </td>

                      {/* Jours */}
                      {Array.from({ length: nbJours }, (_, i) => i + 1).map((jour) => {
                        const paiement = item.paiements.get(jour)
                        const estPaye = !!paiement
                        const dansPlage = membreActifLeJour(item.membre, jour)

                        let tooltip = ''
                        if (estPaye && paiement) {
                          const compte = comptes.find((c) => c.id === paiement.compte_transaction_id)
                          if (compte) tooltip += `${compte.nom} (${compte.numero})`
                          if (paiement.operateur) tooltip += `\n${paiement.operateur}`
                          if (paiement.id_transaction) tooltip += `\nTx: ${paiement.id_transaction}`
                        } else if (!dansPlage) {
                          tooltip = 'Hors période d\'adhésion du membre'
                        }

                        return (
                          <td
                            key={jour}
                            className={`px-0 py-0 text-center ${
                              !dansPlage ? 'bg-gray-100 cursor-not-allowed' : estPaye ? 'cell-paye' : 'cell-non-paye'
                            } ${!peutCocher && !peutDecocher ? 'cursor-default' : ''}`}
                            onClick={() => {
                              if (!dansPlage) return
                              if (estPaye) {
                                if (!peutDecocher) return
                                decocherPaiement(item.membre.id, jour)
                              } else {
                                if (!peutCocher) return
                                ouvrirPopup(item.membre.id, item.membre.nom, jour)
                              }
                            }}
                            title={tooltip || undefined}
                          >
                            <div className="w-full h-7 flex items-center justify-center">
                              {!dansPlage ? (
                                <span className="text-gray-300 text-[10px]">×</span>
                              ) : estPaye ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <span className="text-[10px]">&nbsp;</span>
                              )}
                            </div>
                          </td>
                        )
                      })}

                      {/* Total */}
                      <td className={`sticky right-0 z-10 px-3 py-1.5 text-right font-bold text-primary-700 ${isEven ? 'bg-white' : 'bg-gray-50'}`}>
                        {formatMontant(item.total)}
                      </td>
                    </tr>
                  )
                })}

                {/* Ligne total */}
                <tr className="bg-primary-50 border-t-2 border-primary-200 font-bold">
                  <td className="sticky left-0 bg-primary-50 z-10 px-3 py-2 text-gray-900">TOTAL</td>
                  <td className="px-2 py-2 text-center text-gray-500">
                    {prisesDuMois.length}
                  </td>
                  {Array.from({ length: nbJours }, (_, i) => i + 1).map((jour) => {
                    const payesCeJour = grille.filter((g) => g.paiements.has(jour)).length
                    return (
                      <td key={jour} className="px-0 py-2 text-center text-[10px] text-gray-600">
                        {payesCeJour > 0 ? payesCeJour : ''}
                      </td>
                    )
                  })}
                  <td className="sticky right-0 bg-primary-50 z-10 px-3 py-2 text-right text-primary-800">
                    {formatMontant(totalMois)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== POPUP DE PAIEMENT ===== */}
      {popup && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setPopup(null)}>
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Enregistrer le paiement
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {popup.membreNom} — à partir du {popup.jour} {MOIS_NOMS[mois]} {annee}
            </p>

            <div className="space-y-4">
              <div>
                <label className="label-field">Nombre de jours à cocher *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={nbJours - popup.jour + 1}
                    className="input-field w-24"
                    value={popup.nbJours}
                    onChange={(e) => setPopup({ ...popup, nbJours: Math.max(1, Math.min(Number(e.target.value), nbJours - popup.jour + 1)) })}
                  />
                  <span className="text-sm text-gray-500">
                    jour(s) — du {popup.jour} au {Math.min(popup.jour + popup.nbJours - 1, nbJours)} {MOIS_NOMS[mois]}
                  </span>
                </div>
                {popup.nbJours > 1 && (
                  <p className="text-xs text-primary-600 mt-1">
                    Montant total : {formatMontant(popup.nbJours * (tontine?.montant_journalier || 0))}
                  </p>
                )}
              </div>

              <div>
                <label className="label-field">Numéro de dépôt *</label>
                <select
                  className="input-field"
                  value={popup.compteId}
                  onChange={(e) => changerCompteDansPopup(e.target.value)}
                >
                  <option value="">— Sélectionner le numéro —</option>
                  {comptes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} — {c.numero}
                    </option>
                  ))}
                </select>
                {comptes.length === 0 && (
                  <p className="text-xs text-warning-600 mt-1">
                    Aucun compte configuré.{' '}
                    <Link href="/comptes" className="underline">Ajouter des comptes</Link>
                  </p>
                )}
              </div>

              {/* Sélection opérateur si le compte en a plusieurs */}
              {(() => {
                const compteSel = comptes.find((c) => c.id === popup.compteId)
                const ops = compteSel?.operateurs || []
                if (!compteSel || ops.length === 0) return null
                if (ops.length === 1) {
                  return (
                    <div className="text-xs text-gray-500">
                      Opérateur : <span className="font-medium text-gray-700">{ops[0]}</span>
                    </div>
                  )
                }
                return (
                  <div>
                    <label className="label-field">Opérateur utilisé *</label>
                    <select
                      className="input-field"
                      value={popup.operateur}
                      onChange={(e) => setPopup({ ...popup, operateur: e.target.value })}
                    >
                      <option value="">— Sélectionner l'opérateur —</option>
                      {ops.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                )
              })()}

              <div>
                <label className="label-field">ID de la transaction</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex: TXN-20260407-001"
                  value={popup.idTransaction}
                  onChange={(e) => setPopup({ ...popup, idTransaction: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setPopup(null)} className="btn-secondary text-sm">
                Annuler
              </button>
              <button
                onClick={confirmerPaiement}
                disabled={saving}
                className="btn-success text-sm"
              >
                {saving ? 'Enregistrement...' : 'Confirmer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== POPUP DE PRISE ===== */}
      {prisePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setPrisePopup(null)}>
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg p-5 sm:p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const itemMembre = grille.find((g) => g.membre.id === prisePopup.membreId)
              const nbBras = itemMembre?.membre.nombre_bras || 1
              return (
                <>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Prise — {prisePopup.membreNom}
                  </h3>
                  <p className="text-sm text-gray-500 mb-5">
                    Tontine : {tontine.nom} {nbBras > 1 && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-warning-50 text-warning-700">{prisePopup.prisesExistantes.length}/{nbBras} bras</span>}
                  </p>
                </>
              )
            })()}

            {/* Prises existantes */}
            {prisePopup.prisesExistantes.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Prises existantes</h4>
                <div className="space-y-2">
                  {prisePopup.prisesExistantes.map((p) => (
                    <div key={p.id} className="bg-success-50 rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-success-800">
                          {p.periode || `${MOIS_NOMS[p.mois]} ${p.annee}`}
                        </span>
                        {peutSupprimerPrise && (
                          <button
                            onClick={() => supprimerPrise(p.id)}
                            className="text-danger-500 text-xs font-medium hover:underline"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-success-700 space-y-0.5">
                        {p.date_prise && <div>Date : {new Date(p.date_prise).toLocaleDateString('fr-FR')}</div>}
                        {p.montant && <div>Montant : {formatMontant(p.montant)}</div>}
                        {p.documents_fournis && p.documents_fournis.length > 0 && (
                          <div>Documents : {p.documents_fournis.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulaire nouvelle prise (pas pour responsable, et bras disponibles) */}
            {peutCreerPrise && (() => {
              const itemMembre = grille.find((g) => g.membre.id === prisePopup.membreId)
              const nbBras = itemMembre?.membre.nombre_bras || 1
              if (prisePopup.prisesExistantes.length >= nbBras) {
                return (
                  <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 text-xs text-warning-700">
                    Ce membre a utilisé tous ses bras ({nbBras}). Aucune nouvelle prise possible.
                  </div>
                )
              }
              return null
            })()}
            {peutCreerPrise && (() => {
              const itemMembre = grille.find((g) => g.membre.id === prisePopup.membreId)
              const nbBras = itemMembre?.membre.nombre_bras || 1
              return prisePopup.prisesExistantes.length < nbBras
            })() && (
              <>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  {prisePopup.prisesExistantes.length > 0 ? 'Ajouter une nouvelle prise' : 'Enregistrer la prise'}
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="label-field">Date de prise *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={prisePopup.datePrise}
                      onChange={(e) => setPrisePopup({ ...prisePopup, datePrise: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label-field">Montant</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="Montant de la prise"
                      value={prisePopup.montant}
                      onChange={(e) => setPrisePopup({ ...prisePopup, montant: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label-field">Période</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ex: Mars 2026"
                      value={prisePopup.periode}
                      onChange={(e) => setPrisePopup({ ...prisePopup, periode: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label-field">Documents fournis</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {DOCUMENTS_PRISE.map((doc) => (
                        <label key={doc} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={prisePopup.documents.includes(doc)}
                            onChange={(e) => {
                              const docs = e.target.checked
                                ? [...prisePopup.documents, doc]
                                : prisePopup.documents.filter((d) => d !== doc)
                              setPrisePopup({ ...prisePopup, documents: docs })
                            }}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-gray-700">{doc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button onClick={() => setPrisePopup(null)} className="btn-secondary text-sm">
                    Fermer
                  </button>
                  <button
                    onClick={confirmerPrise}
                    disabled={saving || !prisePopup.datePrise}
                    className="btn-success text-sm"
                  >
                    {saving ? 'Enregistrement...' : 'Confirmer la prise'}
                  </button>
                </div>
              </>
            )}

            {/* Pas de droit de créer : juste fermer */}
            {!peutCreerPrise && (
              <div className="flex justify-end mt-4">
                <button onClick={() => setPrisePopup(null)} className="btn-secondary text-sm">
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Indicateur de sauvegarde */}
      {saving && !popup && !prisePopup && (
        <div className="fixed bottom-4 right-4 bg-primary-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          Enregistrement...
        </div>
      )}
    </div>
  )
}
