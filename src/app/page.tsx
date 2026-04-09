'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Tontine, Membre, CompteTransaction, formatMontant, MOIS_NOMS } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'

interface StatsGlobales {
  totalTontines: number
  totalMembres: number
  totalCollecte: number
  totalPrises: number
}

interface MembreInfo {
  id: string
  nom: string
  contact: string | null
  tontine_id: string
  tontine_nom: string
}

interface MembreStats {
  nom: string
  totalVerse: number
  nbTontines: number
  nbPrises: number
  tontines: { nom: string; verse: number }[]
}

export default function Dashboard() {
  const { hasPermission } = useAuth()
  const peutCreerTontine = hasPermission('tontines.create')
  const [tontines, setTontines] = useState<Tontine[]>([])
  const [stats, setStats] = useState<StatsGlobales>({
    totalTontines: 0,
    totalMembres: 0,
    totalCollecte: 0,
    totalPrises: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filtres
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')
  const [filtreTontineId, setFiltreTontineId] = useState('')
  const [filtreCompteId, setFiltreCompteId] = useState('')
  const [filtreOperateur, setFiltreOperateur] = useState('')
  const [comptesTransaction, setComptesTransaction] = useState<CompteTransaction[]>([])
  const [showFiltres, setShowFiltres] = useState(false)

  // Filtre membre avec autocomplétion
  const [membreSearch, setMembreSearch] = useState('')
  const [membresSuggestions, setMembresSuggestions] = useState<MembreInfo[]>([])
  const [membreSelectionne, setMembreSelectionne] = useState<MembreInfo | null>(null)
  const [membreStats, setMembreStats] = useState<MembreStats | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingMembre, setLoadingMembre] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadTontines()
    loadComptes()
  }, [])

  async function loadComptes() {
    const { data } = await supabase
      .from('comptes_transaction')
      .select('*')
      .eq('actif', true)
      .order('nom')
    setComptesTransaction(data || [])
  }

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      let membresQuery = supabase.from('membres').select('*', { count: 'exact', head: true }).eq('actif', true)
      let cotisationsQuery = supabase.from('cotisations').select('montant')
      let prisesQuery = supabase.from('prises').select('*', { count: 'exact', head: true })
      let tontinesFiltreesIds: string[] | null = null

      if (filtreTontineId) {
        membresQuery = membresQuery.eq('tontine_id', filtreTontineId)
        cotisationsQuery = cotisationsQuery.eq('tontine_id', filtreTontineId)
        prisesQuery = prisesQuery.eq('tontine_id', filtreTontineId)
        tontinesFiltreesIds = [filtreTontineId]
      }
      if (filtreDateDebut) {
        cotisationsQuery = cotisationsQuery.gte('date_paiement', filtreDateDebut)
        prisesQuery = prisesQuery.gte('date_prise', filtreDateDebut)
      }
      if (filtreDateFin) {
        cotisationsQuery = cotisationsQuery.lte('date_paiement', filtreDateFin)
        prisesQuery = prisesQuery.lte('date_prise', filtreDateFin)
      }
      if (filtreCompteId) cotisationsQuery = cotisationsQuery.eq('compte_transaction_id', filtreCompteId)
      if (filtreOperateur) cotisationsQuery = cotisationsQuery.eq('operateur', filtreOperateur)

      const [{ count: membresCount }, { data: cotisationsData }, { count: prisesCount }] = await Promise.all([
        membresQuery, cotisationsQuery, prisesQuery,
      ])

      const totalCollecte = cotisationsData?.reduce((sum, c) => sum + Number(c.montant), 0) || 0
      const totalTontinesAffiches = tontinesFiltreesIds ? tontinesFiltreesIds.length : tontines.length

      setStats({
        totalTontines: totalTontinesAffiches,
        totalMembres: membresCount || 0,
        totalCollecte,
        totalPrises: prisesCount || 0,
      })
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    } finally {
      setLoading(false)
    }
  }, [filtreTontineId, filtreDateDebut, filtreDateFin, filtreCompteId, filtreOperateur, tontines.length])

  useEffect(() => {
    if (tontines.length >= 0) loadStats()
  }, [loadStats])

  async function loadTontines() {
    const { data } = await supabase
      .from('tontines')
      .select('*')
      .eq('actif', true)
      .order('created_at', { ascending: false })
    setTontines(data || [])
  }

  useEffect(() => {
    if (membreSearch.length < 2) {
      setMembresSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('membres')
        .select('id, nom, contact, tontine_id, tontines(nom)')
        .ilike('nom', `%${membreSearch}%`)
        .eq('actif', true)
        .limit(10)

      const suggestions: MembreInfo[] = (data || []).map((m: any) => ({
        id: m.id, nom: m.nom, contact: m.contact,
        tontine_id: m.tontine_id, tontine_nom: m.tontines?.nom || '',
      }))
      setMembresSuggestions(suggestions)
      setShowSuggestions(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [membreSearch])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function selectionnerMembre(membre: MembreInfo) {
    setMembreSelectionne(membre)
    setMembreSearch(membre.nom)
    setShowSuggestions(false)
    setLoadingMembre(true)

    try {
      const { data: membresAll } = await supabase
        .from('membres')
        .select('id, tontine_id, tontines(nom)')
        .eq('nom', membre.nom)
        .eq('actif', true)

      const membreIds = (membresAll || []).map((m: any) => m.id)
      const tontineNoms = (membresAll || []).map((m: any) => ({
        id: m.tontine_id, nom: m.tontines?.nom || '',
      }))

      let cotisQuery = supabase.from('cotisations').select('montant, tontine_id').in('membre_id', membreIds)
      if (filtreDateDebut) cotisQuery = cotisQuery.gte('date_paiement', filtreDateDebut)
      if (filtreDateFin) cotisQuery = cotisQuery.lte('date_paiement', filtreDateFin)
      const { data: cotisations } = await cotisQuery

      const { count: prisesCount } = await supabase
        .from('prises')
        .select('*', { count: 'exact', head: true })
        .in('membre_id', membreIds)

      const parTontine = new Map<string, number>()
      cotisations?.forEach((c: any) => {
        const current = parTontine.get(c.tontine_id) || 0
        parTontine.set(c.tontine_id, current + Number(c.montant))
      })
      const totalVerse = cotisations?.reduce((sum, c) => sum + Number(c.montant), 0) || 0

      setMembreStats({
        nom: membre.nom, totalVerse,
        nbTontines: tontineNoms.length,
        nbPrises: prisesCount || 0,
        tontines: tontineNoms.map((t) => ({ nom: t.nom, verse: parTontine.get(t.id) || 0 })),
      })
    } catch (error) {
      console.error('Erreur stats membre:', error)
    } finally {
      setLoadingMembre(false)
    }
  }

  function resetMembreFiltre() {
    setMembreSearch('')
    setMembreSelectionne(null)
    setMembreStats(null)
    setMembresSuggestions([])
  }

  const moisActuel = new Date().getMonth() + 1
  const anneeActuelle = new Date().getFullYear()
  const compteSelectionne = comptesTransaction.find((c) => c.id === filtreCompteId)
  const operateursDuCompte = compteSelectionne?.operateurs || []
  const hasFilters = filtreDateDebut || filtreDateFin || filtreTontineId || filtreCompteId || filtreOperateur || membreSelectionne

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-1">
            {MOIS_NOMS[moisActuel]} {anneeActuelle} — Vue d'ensemble
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFiltres(!showFiltres)}
            className={`btn-secondary text-sm flex items-center gap-1.5 ${hasFilters ? 'ring-2 ring-primary-300' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtres
          </button>
          {peutCreerTontine && (
            <Link href="/tontines/nouvelle" className="btn-primary text-sm">
              + Nouvelle tontine
            </Link>
          )}
        </div>
      </div>

      {/* Filtres (collapsible) */}
      {showFiltres && (
        <div className="card mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="label-field">Date début</label>
              <input type="date" className="input-field" value={filtreDateDebut}
                onChange={(e) => setFiltreDateDebut(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Date fin</label>
              <input type="date" className="input-field" value={filtreDateFin}
                onChange={(e) => setFiltreDateFin(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Tontine</label>
              <select className="input-field" value={filtreTontineId}
                onChange={(e) => setFiltreTontineId(e.target.value)}>
                <option value="">Toutes</option>
                {tontines.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Compte (n° dépôt)</label>
              <select className="input-field" value={filtreCompteId}
                onChange={(e) => { setFiltreCompteId(e.target.value); setFiltreOperateur('') }}>
                <option value="">Tous</option>
                {comptesTransaction.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom} — {c.numero}</option>
                ))}
              </select>
            </div>
            {filtreCompteId && operateursDuCompte.length > 0 && (
              <div>
                <label className="label-field">Opérateur</label>
                <select className="input-field" value={filtreOperateur}
                  onChange={(e) => setFiltreOperateur(e.target.value)}>
                  <option value="">Tous</option>
                  {operateursDuCompte.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="relative">
              <label className="label-field">Membre</label>
              <div className="relative">
                <input ref={inputRef} type="text" className="input-field pr-8"
                  placeholder="Rechercher..." value={membreSearch}
                  onChange={(e) => {
                    setMembreSearch(e.target.value)
                    if (membreSelectionne) { setMembreSelectionne(null); setMembreStats(null) }
                  }}
                  onFocus={() => membresSuggestions.length > 0 && setShowSuggestions(true)}
                />
                {membreSelectionne && (
                  <button onClick={resetMembreFiltre}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {showSuggestions && membresSuggestions.length > 0 && (
                <div ref={suggestionsRef}
                  className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {membresSuggestions.map((m) => (
                    <button key={`${m.id}-${m.tontine_id}`} onClick={() => selectionnerMembre(m)}
                      className="w-full text-left px-4 py-2.5 hover:bg-primary-50 border-b border-gray-100 last:border-0">
                      <div className="font-medium text-sm text-gray-900">{m.nom}</div>
                      <div className="text-xs text-gray-500">{m.tontine_nom}{m.contact && ` — ${m.contact}`}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {hasFilters && (
            <div className="mt-3 pt-3 border-t">
              <button onClick={() => {
                setFiltreDateDebut(''); setFiltreDateFin(''); setFiltreTontineId(''); setFiltreCompteId(''); setFiltreOperateur(''); resetMembreFiltre()
              }} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fiche membre */}
      {membreSelectionne && (
        <div className="card mb-6 border-l-4 border-l-primary-500">
          {loadingMembre ? (
            <div className="flex items-center gap-3 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
              <span className="text-sm text-gray-500">Chargement...</span>
            </div>
          ) : membreStats ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">{membreStats.nom}</h3>
                <button onClick={resetMembreFiltre} className="text-sm text-gray-400 hover:text-gray-600">Fermer</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-primary-50 rounded-lg p-3 sm:p-4">
                  <p className="text-xs text-primary-600 font-medium">Total versé</p>
                  <p className="text-xl sm:text-2xl font-bold text-primary-800">{formatMontant(membreStats.totalVerse)}</p>
                </div>
                <div className="bg-success-50 rounded-lg p-3 sm:p-4">
                  <p className="text-xs text-success-600 font-medium">Tontines</p>
                  <p className="text-xl sm:text-2xl font-bold text-success-800">{membreStats.nbTontines}</p>
                </div>
                <div className="bg-warning-50 rounded-lg p-3 sm:p-4">
                  <p className="text-xs text-warning-600 font-medium">Prises</p>
                  <p className="text-xl sm:text-2xl font-bold text-warning-800">{membreStats.nbPrises}</p>
                </div>
              </div>
              {membreStats.tontines.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Détail par tontine</h4>
                  <div className="space-y-2">
                    {membreStats.tontines.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 sm:px-4 py-2">
                        <span className="text-sm font-medium">{t.nom}</span>
                        <span className="text-sm font-bold text-primary-700">{formatMontant(t.verse)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Cartes statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <StatCard titre="Tontines actives" valeur={stats.totalTontines.toString()}
          icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          couleur="bg-primary-100 text-primary-600" loading={loading} />
        <StatCard titre="Membres" valeur={stats.totalMembres.toString()}
          icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          couleur="bg-success-50 text-success-600" loading={loading} />
        <StatCard titre="Total collecté" valeur={formatMontant(stats.totalCollecte)}
          icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          couleur="bg-warning-50 text-warning-600" loading={loading} />
        <StatCard titre="Prises" valeur={stats.totalPrises.toString()}
          icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          couleur="bg-danger-50 text-danger-500" loading={loading} />
      </div>

      {/* Liste des tontines */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 sm:mb-6">Vos tontines</h2>
        {tontines.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-gray-500">
            <p className="font-medium">Aucune tontine</p>
            <p className="text-sm mt-1">Créez votre première tontine pour commencer</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {tontines.map((tontine) => (
              <Link key={tontine.id} href={`/tontines/${tontine.id}`}
                className="block p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all duration-200">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{tontine.nom}</h3>
                {tontine.description && (
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{tontine.description}</p>
                )}
                <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs sm:text-sm font-medium text-primary-600">
                    {formatMontant(tontine.montant_journalier)} / jour
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-400">
                    {new Date(tontine.date_debut).toLocaleDateString('fr-FR')} — {new Date(tontine.date_fin).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ titre, valeur, icon, couleur, loading }: {
  titre: string; valeur: string; icon: React.ReactNode; couleur: string; loading?: boolean
}) {
  return (
    <div className="card flex items-center gap-3 sm:gap-4 p-3 sm:p-5">
      <div className={`p-2 sm:p-3 rounded-lg ${couleur} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-gray-500 truncate">{titre}</p>
        {loading ? (
          <div className="h-6 w-16 sm:w-24 bg-gray-200 animate-pulse rounded mt-1" />
        ) : (
          <p className="text-base sm:text-xl font-bold text-gray-900 truncate">{valeur}</p>
        )}
      </div>
    </div>
  )
}
