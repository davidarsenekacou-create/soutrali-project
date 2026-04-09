'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CompteTransaction, OPERATEURS_DISPONIBLES } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'

export default function ComptesPage() {
  const { hasPermission } = useAuth()
  const peutCreer = hasPermission('comptes.create')
  const peutEditer = hasPermission('comptes.edit')
  const peutSupprimer = hasPermission('comptes.delete')
  const peutModifier = peutCreer || peutEditer || peutSupprimer
  const [comptes, setComptes] = useState<CompteTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ nom: string; numero: string; operateurs: string[] }>({
    nom: '', numero: '', operateurs: [],
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data, error } = await supabase
        .from('comptes_transaction').select('*').order('created_at', { ascending: false })
      if (error) console.error('Erreur chargement comptes:', error.message)
      setComptes(data || [])
    } catch (error) { console.error('Erreur chargement:', error) }
    finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      nom: form.nom.trim(),
      numero: form.numero.trim(),
      operateurs: form.operateurs,
    }
    try {
      if (editingId) {
        const { error } = await supabase.from('comptes_transaction').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Compte mis à jour')
      } else {
        const { error } = await supabase.from('comptes_transaction').insert(payload)
        if (error) throw error
        toast.success('Compte ajouté')
      }
      resetForm(); loadData()
    } catch (error: any) { toast.error(error.message || 'Erreur') }
  }

  function resetForm() { setForm({ nom: '', numero: '', operateurs: [] }); setEditingId(null); setShowForm(false) }

  function startEdit(compte: CompteTransaction) {
    setEditingId(compte.id)
    setForm({ nom: compte.nom, numero: compte.numero, operateurs: compte.operateurs || [] })
    setShowForm(true)
  }

  function toggleOperateur(op: string) {
    setForm((f) => ({
      ...f,
      operateurs: f.operateurs.includes(op)
        ? f.operateurs.filter((o) => o !== op)
        : [...f.operateurs, op],
    }))
  }

  async function toggleActif(compte: CompteTransaction) {
    await supabase.from('comptes_transaction').update({ actif: !compte.actif }).eq('id', compte.id)
    loadData()
  }

  async function supprimer(compte: CompteTransaction) {
    if (!confirm(`Supprimer le compte "${compte.nom} - ${compte.numero}" ?`)) return
    await supabase.from('comptes_transaction').delete().eq('id', compte.id)
    toast.success('Compte supprimé'); loadData()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Comptes de transaction</h1>
          <p className="text-gray-500 text-sm mt-1">Numéros Mobile Money / comptes de dépôt</p>
        </div>
        {peutCreer && (
          <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary text-sm self-start sm:self-auto">
            + Ajouter un compte
          </button>
        )}
      </div>

      {/* Formulaire */}
      {showForm && peutModifier && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-4 text-sm sm:text-base">
            {editingId ? 'Modifier le compte' : 'Nouveau compte de transaction'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-field">Nom du titulaire *</label>
                <input type="text" required className="input-field" placeholder="Ex: DIARRA OUMOU"
                  value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Numéro *</label>
                <input type="text" required className="input-field" placeholder="07XXXXXXXX"
                  value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label-field">Opérateurs (un ou plusieurs) *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-1">
                {OPERATEURS_DISPONIBLES.map((op) => (
                  <label key={op} className="flex items-center gap-2 text-sm cursor-pointer p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input type="checkbox" checked={form.operateurs.includes(op)}
                      onChange={() => toggleOperateur(op)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-gray-700">{op}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">Annuler</button>
              <button type="submit" className="btn-primary text-sm">{editingId ? 'Mettre à jour' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {comptes.length === 0 ? (
        <div className="card text-center py-12 sm:py-16">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun compte</h3>
          <p className="text-gray-500 text-sm mb-6">Ajoutez les numéros sur lesquels les cotisations sont versées</p>
        </div>
      ) : (
        <>
          {/* Vue tableau desktop */}
          <div className="card p-0 overflow-hidden hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Titulaire</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Numéro</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Opérateur</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
                  {peutModifier && <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {comptes.map((compte, idx) => (
                  <tr key={compte.id} className={`border-b ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-2.5 font-medium">{compte.nom}</td>
                    <td className="px-4 py-2.5 font-mono">{compte.numero}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {compte.operateurs && compte.operateurs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {compte.operateurs.map((op) => (
                            <span key={op} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-700">{op}</span>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        compte.actif ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'
                      }`}>{compte.actif ? 'Actif' : 'Inactif'}</span>
                    </td>
                    {peutModifier && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {peutEditer && <button onClick={() => startEdit(compte)} className="text-primary-600 text-xs font-medium px-2 py-1 rounded hover:bg-primary-50">Modifier</button>}
                          {peutEditer && <button onClick={() => toggleActif(compte)} className="text-warning-600 text-xs font-medium px-2 py-1 rounded hover:bg-warning-50">{compte.actif ? 'Désactiver' : 'Activer'}</button>}
                          {peutSupprimer && <button onClick={() => supprimer(compte)} className="text-danger-600 text-xs font-medium px-2 py-1 rounded hover:bg-danger-50">Supprimer</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vue cartes mobile */}
          <div className="sm:hidden space-y-3">
            {comptes.map((compte) => (
              <div key={compte.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900">{compte.nom}</h3>
                    <p className="text-sm font-mono text-gray-600">{compte.numero}</p>
                    {compte.operateurs && compte.operateurs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {compte.operateurs.map((op) => (
                          <span key={op} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-700">{op}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    compte.actif ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'
                  }`}>{compte.actif ? 'Actif' : 'Inactif'}</span>
                </div>
                {peutModifier && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    {peutEditer && <button onClick={() => startEdit(compte)} className="text-primary-600 text-xs font-medium">Modifier</button>}
                    {peutEditer && <button onClick={() => toggleActif(compte)} className="text-warning-600 text-xs font-medium">{compte.actif ? 'Désactiver' : 'Activer'}</button>}
                    {peutSupprimer && <button onClick={() => supprimer(compte)} className="text-danger-600 text-xs font-medium">Supprimer</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
