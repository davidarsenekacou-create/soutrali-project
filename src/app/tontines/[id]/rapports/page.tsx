'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Tontine, MOIS_NOMS, joursParMois, formatMontant } from '@/lib/types'
import Link from 'next/link'

interface RapportMembre {
  membre_id: string
  nom: string
  contact: string | null
  jours_payes: number
  total: number
  a_pris: boolean
}

interface RapportMensuel {
  mois: number
  annee: number
  total_collecte: number
  membres_actifs: number
  total_paiements: number
  preneur: string | null
  details: RapportMembre[]
}

export default function RapportsPage() {
  const params = useParams()
  const tontineId = params.id as string

  const [tontine, setTontine] = useState<Tontine | null>(null)
  const [rapports, setRapports] = useState<RapportMensuel[]>([])
  const [loading, setLoading] = useState(true)
  const [moisSelectionne, setMoisSelectionne] = useState<number | null>(null)

  const loadRapports = useCallback(async () => {
    try {
      const { data: t } = await supabase
        .from('tontines')
        .select('*')
        .eq('id', tontineId)
        .single()

      if (!t) return
      setTontine(t)

      // Charger toutes les cotisations de la tontine
      const { data: cotisations } = await supabase
        .from('cotisations')
        .select('*, membres(nom, contact)')
        .eq('tontine_id', tontineId)
        .order('date_paiement', { ascending: true })

      // Charger toutes les prises
      const { data: prises } = await supabase
        .from('prises')
        .select('*, membres(nom)')
        .eq('tontine_id', tontineId)

      // Charger les membres
      const { data: membres } = await supabase
        .from('membres')
        .select('*')
        .eq('tontine_id', tontineId)
        .eq('actif', true)

      // Construire les rapports par mois
      const parMois = new Map<string, RapportMensuel>()

      const dateDebut = new Date(t.date_debut)
      const dateFin = new Date(t.date_fin)

      // Créer les mois entre début et fin
      let current = new Date(dateDebut.getFullYear(), dateDebut.getMonth(), 1)
      while (current <= dateFin) {
        const m = current.getMonth() + 1
        const a = current.getFullYear()
        const key = `${a}-${m}`

        const prise = prises?.find((p: any) => p.mois === m && p.annee === a)

        parMois.set(key, {
          mois: m,
          annee: a,
          total_collecte: 0,
          membres_actifs: 0,
          total_paiements: 0,
          preneur: prise ? (prise as any).membres?.nom : null,
          details: [],
        })

        current.setMonth(current.getMonth() + 1)
      }

      // Remplir les détails
      const membresActifsParMois = new Map<string, Set<string>>()

      cotisations?.forEach((c: any) => {
        const date = new Date(c.date_paiement)
        const m = date.getMonth() + 1
        const a = date.getFullYear()
        const key = `${a}-${m}`

        const rapport = parMois.get(key)
        if (!rapport) return

        rapport.total_collecte += Number(c.montant)
        rapport.total_paiements += 1

        if (!membresActifsParMois.has(key)) membresActifsParMois.set(key, new Set())
        membresActifsParMois.get(key)!.add(c.membre_id)
      })

      membresActifsParMois.forEach((set, key) => {
        const rapport = parMois.get(key)
        if (rapport) rapport.membres_actifs = set.size
      })

      // Construire les détails par membre pour chaque mois
      parMois.forEach((rapport, key) => {
        const details: RapportMembre[] = []

        membres?.forEach((membre) => {
          const paiements = cotisations?.filter((c: any) => {
            const date = new Date(c.date_paiement)
            return c.membre_id === membre.id &&
              date.getMonth() + 1 === rapport.mois &&
              date.getFullYear() === rapport.annee
          }) || []

          const prise = prises?.find(
            (p: any) => p.membre_id === membre.id && p.mois === rapport.mois && p.annee === rapport.annee
          )

          details.push({
            membre_id: membre.id,
            nom: membre.nom,
            contact: membre.contact,
            jours_payes: paiements.length,
            total: paiements.length * t.montant_journalier,
            a_pris: !!prise,
          })
        })

        rapport.details = details.sort((a, b) => b.total - a.total)
      })

      setRapports(
        Array.from(parMois.values()).sort((a, b) =>
          a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois
        )
      )
    } catch (error) {
      console.error('Erreur chargement rapports:', error)
    } finally {
      setLoading(false)
    }
  }, [tontineId])

  useEffect(() => {
    loadRapports()
  }, [loadRapports])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const rapportDetail = moisSelectionne !== null ? rapports[moisSelectionne] : null
  const totalGeneral = rapports.reduce((sum, r) => sum + r.total_collecte, 0)

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6">
        <Link
          href={`/tontines/${tontineId}`}
          className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block"
        >
          &larr; Retour à la grille
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Rapports — {tontine?.nom}
        </h1>
        <p className="text-gray-500 mt-1">Synthèse des collectes et attributions</p>
      </div>

      {/* Total général */}
      <div className="card mb-6 bg-primary-50 border-primary-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary-600 font-medium">Total général collecté</p>
            <p className="text-3xl font-bold text-primary-800">{formatMontant(totalGeneral)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-primary-600">
              {rapports.filter((r) => r.preneur).length} / {rapports.length} prises attribuées
            </p>
          </div>
        </div>
      </div>

      {/* Résumé par mois */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {rapports.map((rapport, idx) => (
          <div
            key={`${rapport.annee}-${rapport.mois}`}
            className={`card cursor-pointer transition-all duration-200 hover:shadow-md ${
              moisSelectionne === idx ? 'ring-2 ring-primary-500 border-primary-500' : ''
            }`}
            onClick={() => setMoisSelectionne(moisSelectionne === idx ? null : idx)}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                {MOIS_NOMS[rapport.mois]} {rapport.annee}
              </h3>
              {rapport.preneur && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-700">
                  Prise: {rapport.preneur}
                </span>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Collecté</span>
                <span className="font-semibold">{formatMontant(rapport.total_collecte)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Membres actifs</span>
                <span>{rapport.membres_actifs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total paiements</span>
                <span>{rapport.total_paiements}</span>
              </div>
            </div>

            {/* Barre de progression */}
            {tontine && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (rapport.membres_actifs / Math.max(1, rapport.details.length)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Taux de participation: {rapport.details.length > 0
                    ? Math.round((rapport.membres_actifs / rapport.details.length) * 100)
                    : 0}%
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Détail du mois sélectionné */}
      {rapportDetail && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">
            Détail — {MOIS_NOMS[rapportDetail.mois]} {rapportDetail.annee}
          </h2>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Membre</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Jours payés</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total cotisé</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Prise</th>
              </tr>
            </thead>
            <tbody>
              {rapportDetail.details.map((d, idx) => (
                <tr key={d.membre_id} className={`border-b ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium">{d.nom}</td>
                  <td className="px-4 py-2 text-gray-500">{d.contact || '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.jours_payes > 0 ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {d.jours_payes} / {joursParMois(rapportDetail.mois, rapportDetail.annee)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-primary-700">
                    {formatMontant(d.total)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {d.a_pris && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success-500 text-white text-xs font-bold">
                        1
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary-50 font-bold border-t-2 border-primary-200">
                <td colSpan={3} className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-center">
                  {rapportDetail.total_paiements}
                </td>
                <td className="px-4 py-3 text-right text-primary-800">
                  {formatMontant(rapportDetail.total_collecte)}
                </td>
                <td className="px-4 py-3 text-center">
                  {rapportDetail.details.filter((d) => d.a_pris).length}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
