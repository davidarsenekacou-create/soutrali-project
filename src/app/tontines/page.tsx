'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Tontine, formatMontant } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'

export default function TontinesPage() {
  const { isAdmin, peutAccederTontine, hasPermission } = useAuth()
  const peutCreer = hasPermission('tontines.create')
  const peutEditerT = hasPermission('tontines.edit')
  const peutSupprimerT = hasPermission('tontines.delete')
  const [tontines, setTontines] = useState<Tontine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTontines()
  }, [])

  async function loadTontines() {
    const { data } = await supabase
      .from('tontines')
      .select('*')
      .order('created_at', { ascending: false })

    setTontines(data || [])
    setLoading(false)
  }

  async function toggleActif(id: string, actif: boolean) {
    await supabase.from('tontines').update({ actif: !actif }).eq('id', id)
    loadTontines()
  }

  async function supprimerTontine(id: string, nom: string) {
    if (!confirm(`Supprimer la tontine "${nom}" et toutes ses données ?`)) return
    await supabase.from('tontines').delete().eq('id', id)
    loadTontines()
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tontines</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? 'Gérez vos groupes de tontine' : 'Vos tontines assignées'}
          </p>
        </div>
        {peutCreer && (
          <Link href="/tontines/nouvelle" className="btn-primary text-sm self-start sm:self-auto">
            + Nouvelle tontine
          </Link>
        )}
      </div>

      {tontines.length === 0 ? (
        <div className="card text-center py-12 sm:py-16">
          <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune tontine</h3>
          <p className="text-gray-500 mb-6 text-sm">
            {isAdmin ? 'Commencez par créer votre première tontine' : 'Aucune tontine ne vous est assignée'}
          </p>
          {peutCreer && (
            <Link href="/tontines/nouvelle" className="btn-primary">Créer une tontine</Link>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {tontines.map((tontine) => {
            const accessible = peutAccederTontine(tontine.id)

            return (
              <div
                key={tontine.id}
                className={`card ${!accessible ? 'opacity-50 grayscale' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{tontine.nom}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tontine.actif ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {tontine.actif ? 'Active' : 'Inactive'}
                      </span>
                      {!accessible && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Non assignée
                        </span>
                      )}
                    </div>
                    {tontine.description && (
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">{tontine.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-500">
                      <span>{formatMontant(tontine.montant_journalier)} / jour</span>
                      <span>
                        {new Date(tontine.date_debut).toLocaleDateString('fr-FR')} — {new Date(tontine.date_fin).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {accessible ? (
                      <>
                        <Link href={`/tontines/${tontine.id}`} className="btn-primary text-xs sm:text-sm">
                          Ouvrir
                        </Link>
                        <Link href={`/tontines/${tontine.id}/membres`} className="btn-secondary text-xs sm:text-sm">
                          Membres
                        </Link>
                        {peutEditerT && (
                          <button onClick={() => toggleActif(tontine.id, tontine.actif)} className="btn-secondary text-xs sm:text-sm">
                            {tontine.actif ? 'Désactiver' : 'Activer'}
                          </button>
                        )}
                        {peutSupprimerT && (
                          <button onClick={() => supprimerTontine(tontine.id, tontine.nom)} className="btn-danger text-xs sm:text-sm">
                            Supprimer
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Accès restreint</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
