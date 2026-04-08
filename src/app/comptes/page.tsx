'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CompteTransaction } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'

export default function ComptesPage() {
  const { peutModifier } = useAuth()
  const [comptes, setComptes] = useState<CompteTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nom: '', numero: '', operateur: '' })

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
    const payload = { nom: form.nom.trim(), numero: form.numero.trim(), operateur: form.operateur.trim() || null }
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

  function resetForm() { setForm({ nom: '', numero: '', operateur: '' }); setEditingId(null); setShowForm(false) }

  function startEdit(compte: CompteTransaction) {
    setEditingId(compte.id)
    setForm({ nom: compte.nom, numero: compte.numero, operateur: compte.operateur || '' })
    setShowForm(true)
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
        {peutModifier && (
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
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div>
              <label className="label-field">Opérateur</label>
              <select className="input-field" value={form.operateur}
                onChange={(e) => setForm({ ...form, operateur: e.target.value })}>
                <option value="">Sélectionner...</option>
                <option value="Orange Money">Orange Money</option>
                <option value="MTN Mobile Money">MTN Mobile Money</option>
                <option value="Moov Money">Moov Money</option>
                <option value="Wave">Wave</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="btn-primary text-sm">{editingId ? 'Mettre à jour' : 'Ajouter'}</button>
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">Annuler</button>
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
                    <td className="px-4 py-2.5 text-gray-500">{compte.operateur || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        compte.actif ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'
                      }`}>{compte.actif ? 'Actif' : 'Inactif'}</span>
                    </td>
                    {peutModifier && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(compte)} className="text-primary-600 text-xs font-medium px-2 py-1 rounded hover:bg-primary-50">Modifier</button>
                          <button onClick={() => toggleActif(compte)} className="text-warning-600 text-xs font-medium px-2 py-1 rounded hover:bg-warning-50">{compte.actif ? 'Désactiver' : 'Activer'}</button>
                          <button onClick={() => supprimer(compte)} className="text-danger-600 text-xs font-medium px-2 py-1 rounded hover:bg-danger-50">Supprimer</button>
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
                    {compte.operateur && <p className="text-xs text-gray-500">{compte.operateur}</p>}
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    compte.actif ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'
                  }`}>{compte.actif ? 'Actif' : 'Inactif'}</span>
                </div>
                {peutModifier && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <button onClick={() => startEdit(compte)} className="text-primary-600 text-xs font-medium">Modifier</button>
                    <button onClick={() => toggleActif(compte)} className="text-warning-600 text-xs font-medium">{compte.actif ? 'Désactiver' : 'Activer'}</button>
                    <button onClick={() => supprimer(compte)} className="text-danger-600 text-xs font-medium">Supprimer</button>
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
