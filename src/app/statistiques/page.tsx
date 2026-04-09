'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Tontine, Membre, CompteTransaction, Prise, formatMontant } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// Palette cohérente avec le thème Tailwind
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#93c5fd',
  success: '#10b981',
  successLight: '#6ee7b7',
  warning: '#f59e0b',
  danger: '#ef4444',
  gray: '#9ca3af',
}
const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

interface CotisationRow {
  id: string
  tontine_id: string
  membre_id: string
  date_paiement: string
  montant: number
  compte_transaction_id: string | null
  operateur: string | null
}

export default function StatistiquesPage() {
  const { hasPermission } = useAuth()
  const [loading, setLoading] = useState(true)

  const [tontines, setTontines] = useState<Tontine[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [cotisations, setCotisations] = useState<CotisationRow[]>([])
  const [prises, setPrises] = useState<Prise[]>([])
  const [comptes, setComptes] = useState<CompteTransaction[]>([])

  // Filtres
  const [filtreTontineId, setFiltreTontineId] = useState('')
  const [periode, setPeriode] = useState<'7' | '30' | '90' | 'all'>('30')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [t, m, c, p, ct] = await Promise.all([
        supabase.from('tontines').select('*').eq('actif', true).order('nom'),
        supabase.from('membres').select('*').eq('actif', true),
        supabase.from('cotisations').select('id, tontine_id, membre_id, date_paiement, montant, compte_transaction_id, operateur'),
        supabase.from('prises').select('*'),
        supabase.from('comptes_transaction').select('*'),
      ])
      setTontines(t.data || [])
      setMembres(m.data || [])
      setCotisations((c.data as any) || [])
      setPrises((p.data as any) || [])
      setComptes(ct.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Helper : tontines visibles selon filtre
  const tontinesAffichees = useMemo(
    () => filtreTontineId ? tontines.filter((t) => t.id === filtreTontineId) : tontines,
    [tontines, filtreTontineId]
  )

  // Plage de dates pour la période sélectionnée
  const { dateDebut, dateFin } = useMemo(() => {
    const fin = new Date()
    fin.setHours(23, 59, 59, 999)
    if (periode === 'all') {
      return { dateDebut: null, dateFin: fin }
    }
    const debut = new Date()
    debut.setDate(debut.getDate() - Number(periode) + 1)
    debut.setHours(0, 0, 0, 0)
    return { dateDebut: debut, dateFin: fin }
  }, [periode])

  // Cotisations filtrées
  const cotisationsFiltrees = useMemo(() => {
    return cotisations.filter((c) => {
      if (filtreTontineId && c.tontine_id !== filtreTontineId) return false
      if (dateDebut) {
        const d = new Date(c.date_paiement)
        if (d < dateDebut || d > dateFin) return false
      }
      return true
    })
  }, [cotisations, filtreTontineId, dateDebut, dateFin])

  // ======================================================================
  // CHART 1 : Santé des tontines (Attendu vs Collecté)
  // ======================================================================
  const dataChart1 = useMemo(() => {
    return tontinesAffichees.map((t) => {
      const membresT = membres.filter((m) => m.tontine_id === t.id)

      // Calcul de l'attendu : pour chaque membre, jours actifs entre debut et aujourd'hui (ou date_fin si avant)
      const auj = new Date()
      const finReelle = new Date(Math.min(auj.getTime(), new Date(t.date_fin).getTime()))
      let attendu = 0
      membresT.forEach((m) => {
        const debutMembre = new Date(m.date_debut || t.date_debut)
        const finMembre = new Date(m.date_fin || t.date_fin)
        const debut = debutMembre > new Date(t.date_debut) ? debutMembre : new Date(t.date_debut)
        const fin = finMembre < finReelle ? finMembre : finReelle
        if (fin >= debut) {
          const jours = Math.floor((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)) + 1
          attendu += jours * t.montant_journalier
        }
      })

      const collecte = cotisations
        .filter((c) => c.tontine_id === t.id)
        .reduce((sum, c) => sum + Number(c.montant), 0)

      const taux = attendu > 0 ? Math.round((collecte / attendu) * 100) : 0
      return {
        nom: t.nom.length > 25 ? t.nom.substring(0, 25) + '…' : t.nom,
        Attendu: attendu,
        Collecté: collecte,
        taux,
      }
    })
  }, [tontinesAffichees, membres, cotisations])

  // ======================================================================
  // CHART 2 : Courbe de collecte journalière sur la période
  // ======================================================================
  const dataChart2 = useMemo(() => {
    if (!dateDebut) {
      // 'all' : agréger par mois
      const map = new Map<string, number>()
      cotisationsFiltrees.forEach((c) => {
        const d = new Date(c.date_paiement)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        map.set(key, (map.get(key) || 0) + Number(c.montant))
      })
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, montant]) => ({ label: key, montant }))
    }
    // 7/30/90 jours
    const days: { label: string; montant: number; key: string }[] = []
    const cur = new Date(dateDebut)
    while (cur <= dateFin) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      const label = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`
      days.push({ key, label, montant: 0 })
      cur.setDate(cur.getDate() + 1)
    }
    cotisationsFiltrees.forEach((c) => {
      const day = days.find((d) => d.key === c.date_paiement)
      if (day) day.montant += Number(c.montant)
    })
    // Moyenne mobile 7 jours
    return days.map((d, i, arr) => {
      const window = arr.slice(Math.max(0, i - 6), i + 1)
      const moyenne = window.reduce((s, x) => s + x.montant, 0) / window.length
      return { label: d.label, montant: d.montant, moyenne: Math.round(moyenne) }
    })
  }, [cotisationsFiltrees, dateDebut, dateFin])

  // ======================================================================
  // CHART 3 : Répartition par compte / opérateur (donut)
  // ======================================================================
  const dataChart3 = useMemo(() => {
    const map = new Map<string, number>()
    cotisationsFiltrees.forEach((c) => {
      const compte = comptes.find((cp) => cp.id === c.compte_transaction_id)
      const label = compte ? `${compte.nom} (${compte.numero})` : 'Non renseigné'
      map.set(label, (map.get(label) || 0) + Number(c.montant))
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [cotisationsFiltrees, comptes])

  // ======================================================================
  // CHART 4 : Top 10 contributeurs / Top 10 retardataires
  // ======================================================================
  const { topContributeurs, topRetardataires } = useMemo(() => {
    const auj = new Date()

    // Total payé par membre dans la période
    const paye = new Map<string, number>()
    cotisationsFiltrees.forEach((c) => {
      paye.set(c.membre_id, (paye.get(c.membre_id) || 0) + Number(c.montant))
    })

    // Pour les retardataires : attendu vs payé (sur toute la durée du membre, pas juste la période)
    const stats = membres
      .filter((m) => !filtreTontineId || m.tontine_id === filtreTontineId)
      .map((m) => {
        const t = tontines.find((tt) => tt.id === m.tontine_id)
        if (!t) return null
        const debutMembre = new Date(m.date_debut || t.date_debut)
        const finMembre = new Date(m.date_fin || t.date_fin)
        const fin = finMembre < auj ? finMembre : auj
        const jours = fin >= debutMembre
          ? Math.floor((fin.getTime() - debutMembre.getTime()) / (1000 * 60 * 60 * 24)) + 1
          : 0
        const attendu = jours * t.montant_journalier
        const payeTotal = cotisations
          .filter((c) => c.membre_id === m.id)
          .reduce((s, c) => s + Number(c.montant), 0)
        const ecart = attendu - payeTotal
        return { id: m.id, nom: m.nom, payePeriode: paye.get(m.id) || 0, ecart, attendu }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const top = [...stats]
      .filter((s) => s.payePeriode > 0)
      .sort((a, b) => b.payePeriode - a.payePeriode)
      .slice(0, 10)
      .map((s) => ({
        nom: s.nom.length > 20 ? s.nom.substring(0, 20) + '…' : s.nom,
        montant: s.payePeriode,
      }))

    const retard = [...stats]
      .filter((s) => s.ecart > 0)
      .sort((a, b) => b.ecart - a.ecart)
      .slice(0, 10)
      .map((s) => ({
        nom: s.nom.length > 20 ? s.nom.substring(0, 20) + '…' : s.nom,
        retard: s.ecart,
      }))

    return { topContributeurs: top, topRetardataires: retard }
  }, [membres, tontines, cotisations, cotisationsFiltrees, filtreTontineId])

  // ======================================================================
  // CHART 5 : Bras consommés vs disponibles par tontine
  // ======================================================================
  const dataChart5 = useMemo(() => {
    return tontinesAffichees.map((t) => {
      const membresT = membres.filter((m) => m.tontine_id === t.id)
      const totalBras = membresT.reduce((s, m) => s + (m.nombre_bras || 1), 0)
      const consommes = prises.filter((p) => p.tontine_id === t.id).length
      const restants = Math.max(0, totalBras - consommes)
      return {
        nom: t.nom.length > 25 ? t.nom.substring(0, 25) + '…' : t.nom,
        Consommés: consommes,
        Restants: restants,
        pct: totalBras > 0 ? Math.round((consommes / totalBras) * 100) : 0,
      }
    })
  }, [tontinesAffichees, membres, prises])

  // ======================================================================
  // CHART 6 : Heatmap calendrier (12 dernières semaines)
  // ======================================================================
  const heatmapData = useMemo(() => {
    // 12 semaines = 84 jours
    const weeks: { date: Date; montant: number }[][] = []
    const auj = new Date()
    auj.setHours(0, 0, 0, 0)
    const debut = new Date(auj)
    debut.setDate(debut.getDate() - 83)
    // Aligner sur lundi
    const dayOffset = (debut.getDay() + 6) % 7
    debut.setDate(debut.getDate() - dayOffset)

    const cotisParJour = new Map<string, number>()
    cotisations.forEach((c) => {
      if (filtreTontineId && c.tontine_id !== filtreTontineId) return
      cotisParJour.set(c.date_paiement, (cotisParJour.get(c.date_paiement) || 0) + Number(c.montant))
    })

    const cur = new Date(debut)
    while (cur <= auj) {
      const week: { date: Date; montant: number }[] = []
      for (let i = 0; i < 7; i++) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        week.push({ date: new Date(cur), montant: cotisParJour.get(key) || 0 })
        cur.setDate(cur.getDate() + 1)
      }
      weeks.push(week)
    }
    const max = Math.max(1, ...weeks.flat().map((d) => d.montant))
    return { weeks, max }
  }, [cotisations, filtreTontineId])

  if (!hasPermission('view.statistiques')) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Accès réservé</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div>
      {/* En-tête + filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Statistiques</h1>
          <p className="text-gray-500 text-sm mt-1">Analyse de la performance des tontines</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Tontine</label>
            <select className="input-field" value={filtreTontineId}
              onChange={(e) => setFiltreTontineId(e.target.value)}>
              <option value="">Toutes les tontines</option>
              {tontines.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Période</label>
            <div className="flex gap-2">
              {[
                { v: '7', l: '7 jours' },
                { v: '30', l: '30 jours' },
                { v: '90', l: '90 jours' },
                { v: 'all', l: 'Tout' },
              ].map((p) => (
                <button
                  key={p.v}
                  onClick={() => setPeriode(p.v as any)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    periode === p.v
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* === CHART 1 === */}
      <div className="card mb-6">
        <h2 className="font-bold text-gray-900 mb-1">Santé des tontines</h2>
        <p className="text-xs text-gray-500 mb-4">Comparaison du montant attendu et du montant réellement collecté</p>
        {dataChart1.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, dataChart1.length * 60)}>
            <BarChart data={dataChart1} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
              <YAxis type="category" dataKey="nom" width={140} fontSize={11} />
              <Tooltip formatter={(v: any) => formatMontant(Number(v))} />
              <Legend />
              <Bar dataKey="Attendu" fill={COLORS.gray} radius={[0, 4, 4, 0]} />
              <Bar dataKey="Collecté" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {dataChart1.length > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {dataChart1.map((d) => (
              <div key={d.nom} className="bg-gray-50 rounded px-2 py-1">
                <span className="text-gray-500">{d.nom} : </span>
                <span className={`font-bold ${d.taux >= 90 ? 'text-success-700' : d.taux >= 60 ? 'text-warning-600' : 'text-danger-600'}`}>{d.taux}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === CHART 2 === */}
      <div className="card mb-6">
        <h2 className="font-bold text-gray-900 mb-1">Évolution de la collecte</h2>
        <p className="text-xs text-gray-500 mb-4">
          {periode === 'all' ? 'Cumul mensuel sur toute la période' : `Cotisations journalières (moyenne mobile sur 7 jours)`}
        </p>
        {dataChart2.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dataChart2}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
              <Tooltip formatter={(v: any) => formatMontant(Number(v))} />
              <Legend />
              <Area type="monotone" dataKey="montant" name="Cotisé" stroke={COLORS.primary} fillOpacity={1} fill="url(#grad1)" />
              {periode !== 'all' && (
                <Area type="monotone" dataKey="moyenne" name="Moyenne 7j" stroke={COLORS.warning} fill="transparent" strokeDasharray="5 5" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* === CHART 3 + CHART 5 côte à côte === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 3 : Donut comptes */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-1">Répartition par compte de dépôt</h2>
          <p className="text-xs text-gray-500 mb-4">Où arrive l'argent collecté</p>
          {dataChart3.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={dataChart3} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {dataChart3.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatMontant(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 5 : Bras consommés */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-1">Suivi des bras (prises)</h2>
          <p className="text-xs text-gray-500 mb-4">Bras consommés vs bras restants par tontine</p>
          {dataChart5.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, dataChart5.length * 50)}>
              <BarChart data={dataChart5} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="nom" width={120} fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Consommés" stackId="a" fill={COLORS.success} />
                <Bar dataKey="Restants" stackId="a" fill={COLORS.gray} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* === CHART 4 : Top contributeurs / retardataires === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-1">Top 10 contributeurs</h2>
          <p className="text-xs text-gray-500 mb-4">Membres ayant le plus versé sur la période</p>
          {topContributeurs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, topContributeurs.length * 32)}>
              <BarChart data={topContributeurs} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <YAxis type="category" dataKey="nom" width={130} fontSize={11} />
                <Tooltip formatter={(v: any) => formatMontant(Number(v))} />
                <Bar dataKey="montant" fill={COLORS.success} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold text-gray-900 mb-1">Top 10 retardataires</h2>
          <p className="text-xs text-gray-500 mb-4">Plus grand écart entre attendu et payé (toute la durée)</p>
          {topRetardataires.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun retard</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, topRetardataires.length * 32)}>
              <BarChart data={topRetardataires} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <YAxis type="category" dataKey="nom" width={130} fontSize={11} />
                <Tooltip formatter={(v: any) => formatMontant(Number(v))} />
                <Bar dataKey="retard" fill={COLORS.danger} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* === CHART 6 : Heatmap calendrier === */}
      <div className="card mb-6">
        <h2 className="font-bold text-gray-900 mb-1">Régularité de la collecte</h2>
        <p className="text-xs text-gray-500 mb-4">Activité jour par jour sur les 12 dernières semaines</p>
        <div className="overflow-x-auto">
          <div className="inline-flex gap-1 min-w-max">
            {/* Labels jours */}
            <div className="flex flex-col gap-1 pr-2 text-[10px] text-gray-400 justify-around pt-1">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => (
                <span key={i} className="h-3 leading-3">{j}</span>
              ))}
            </div>
            {heatmapData.weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => {
                  const intensity = day.montant / heatmapData.max
                  const bg = day.montant === 0
                    ? '#f3f4f6'
                    : intensity < 0.25 ? '#bfdbfe'
                    : intensity < 0.5 ? '#60a5fa'
                    : intensity < 0.75 ? '#2563eb'
                    : '#1e3a8a'
                  return (
                    <div
                      key={di}
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: bg }}
                      title={`${day.date.toLocaleDateString('fr-FR')} : ${formatMontant(day.montant)}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-500">
          <span>Moins</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f3f4f6' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#bfdbfe' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#60a5fa' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#2563eb' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#1e3a8a' }} />
          </div>
          <span>Plus</span>
        </div>
      </div>
    </div>
  )
}
