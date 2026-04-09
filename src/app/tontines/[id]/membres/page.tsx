'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Tontine, Membre } from '@/lib/types'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'

export default function MembresPage() {
  const params = useParams()
  const tontineId = params.id as string
  const { hasPermission } = useAuth()
  const peutCreer = hasPermission('membres.create')
  const peutEditer = hasPermission('membres.edit')
  const peutToggle = hasPermission('membres.toggle')
  const peutSupprimerM = hasPermission('membres.delete')
  const peutModifier = peutCreer || peutEditer || peutToggle || peutSupprimerM

  const [tontine, setTontine] = useState<Tontine | null>(null)
  const [membres, setMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nom: '', contact: '', numero_ordre: '', nombre_bras: '1', date_debut: '', date_fin: '' })
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [tontineId])

  async function loadData() {
    const { data: t } = await supabase.from('tontines').select('*').eq('id', tontineId).single()
    const { data: m } = await supabase.from('membres').select('*').eq('tontine_id', tontineId)
      .order('numero_ordre', { ascending: true }).order('nom', { ascending: true })
    setTontine(t); setMembres(m || []); setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      tontine_id: tontineId,
      nom: form.nom.trim().toUpperCase(),
      contact: form.contact.trim() || null,
      numero_ordre: form.numero_ordre ? Number(form.numero_ordre) : null,
      nombre_bras: Math.max(1, Number(form.nombre_bras) || 1),
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
    }
    try {
      if (editingId) {
        const { error } = await supabase.from('membres').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Membre mis à jour')
      } else {
        const { error } = await supabase.from('membres').insert(payload)
        if (error) throw error
        toast.success('Membre ajouté')
      }
      setForm({ nom: '', contact: '', numero_ordre: '', nombre_bras: '1', date_debut: '', date_fin: '' }); setEditingId(null); setShowForm(false); loadData()
    } catch (error: any) { toast.error(error.message || 'Erreur') }
  }

  function startEdit(membre: Membre) {
    setEditingId(membre.id)
    setForm({
      nom: membre.nom,
      contact: membre.contact || '',
      numero_ordre: membre.numero_ordre?.toString() || '',
      nombre_bras: (membre.nombre_bras || 1).toString(),
      date_debut: membre.date_debut || '',
      date_fin: membre.date_fin || '',
    })
    setShowForm(true)
  }

  async function toggleActif(membre: Membre) {
    await supabase.from('membres').update({ actif: !membre.actif }).eq('id', membre.id); loadData()
  }

  async function supprimerMembre(membre: Membre) {
    if (!confirm(`Supprimer ${membre.nom} et toutes ses cotisations ?`)) return
    try { await supabase.from('membres').delete().eq('id', membre.id); toast.success('Membre supprimé'); loadData() }
    catch { toast.error('Erreur suppression') }
  }

  async function handleImport() {
    const lines = importText.trim().split('\n').filter(Boolean)
    if (lines.length === 0) return
    const inserts = lines.map((line, i) => {
      const parts = line.split(/[,;\t]/).map((s) => s.trim())
      return { tontine_id: tontineId, nom: (parts[0] || '').toUpperCase(), contact: parts[1] || null, numero_ordre: membres.length + i + 1 }
    }).filter((m) => m.nom.length > 0)
    try {
      const { error } = await supabase.from('membres').insert(inserts)
      if (error) throw error
      toast.success(`${inserts.length} membre(s) importé(s)`); setImportText(''); setShowImport(false); loadData()
    } catch (error: any) { toast.error(error.message || 'Erreur import') }
  }

  const membresFiltres = membres.filter((m) =>
    m.nom.toLowerCase().includes(search.toLowerCase()) || (m.contact && m.contact.includes(search))
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/tontines/${tontineId}`} className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block">
          &larr; Retour à la grille
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Membres — {tontine?.nom}</h1>
            <p className="text-gray-500 text-sm mt-1">{membres.length} membre(s) inscrits</p>
          </div>
          {peutCreer && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowImport(!showImport)} className="btn-secondary text-xs sm:text-sm">Import en masse</button>
              <button onClick={() => {
                setEditingId(null); setForm({ nom: '', contact: '', numero_ordre: String(membres.length + 1), nombre_bras: '1', date_debut: '', date_fin: '' }); setShowForm(true)
              }} className="btn-primary text-xs sm:text-sm">+ Ajouter</button>
            </div>
          )}
        </div>
      </div>

      {/* Import */}
      {showImport && peutCreer && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-2 text-sm">Import en masse</h3>
          <p className="text-xs text-gray-500 mb-3">Un membre par ligne : NOM, CONTACT</p>
          <textarea className="input-field font-mono text-sm" rows={6} placeholder={`DIARRA OUMOU, 0701020304\nBAMBA MABA, 0705060708`}
            value={importText} onChange={(e) => setImportText(e.target.value)} />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowImport(false)} className="btn-secondary text-sm">Annuler</button>
            <button onClick={handleImport} className="btn-primary text-sm">Importer</button>
          </div>
        </div>
      )}

      {/* Formulaire */}
      {showForm && peutModifier && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-4 text-sm">{editingId ? 'Modifier le membre' : 'Ajouter un membre'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label-field">Nom *</label>
                <input type="text" required className="input-field" placeholder="NOM PRENOM"
                  value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Contact</label>
                <input type="text" className="input-field" placeholder="07XXXXXXXX"
                  value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </div>
              <div>
                <label className="label-field">N° ordre</label>
                <input type="number" className="input-field" value={form.numero_ordre}
                  onChange={(e) => setForm({ ...form, numero_ordre: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Nombre de bras *</label>
                <input type="number" min={1} required className="input-field" value={form.nombre_bras}
                  onChange={(e) => setForm({ ...form, nombre_bras: e.target.value })} />
                <p className="text-[10px] text-gray-400 mt-1">Nombre de prises possibles</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-field">Date de début (optionnel)</label>
                <input type="date" className="input-field" value={form.date_debut}
                  onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
                <p className="text-[10px] text-gray-400 mt-1">Si vide, début de la tontine</p>
              </div>
              <div>
                <label className="label-field">Date de fin (optionnel)</label>
                <input type="date" className="input-field" value={form.date_fin}
                  onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
                <p className="text-[10px] text-gray-400 mt-1">Si vide, fin de la tontine</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary text-sm">Annuler</button>
              <button type="submit" className="btn-primary text-sm">{editingId ? 'Mettre à jour' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Recherche */}
      <div className="mb-4">
        <input type="text" className="input-field w-full sm:max-w-md" placeholder="Rechercher un membre..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Liste - tableau desktop */}
      <div className="card p-0 overflow-hidden hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-12">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Nom</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Bras</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
              {peutModifier && <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {membresFiltres.map((membre, idx) => (
              <tr key={membre.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <td className="px-4 py-2.5 text-gray-400">{membre.numero_ordre || idx + 1}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{membre.nom}</td>
                <td className="px-4 py-2.5 text-gray-600">{membre.contact || '—'}</td>
                <td className="px-4 py-2.5 text-center">
                  {(membre.nombre_bras || 1) > 1 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-warning-50 text-warning-700">×{membre.nombre_bras}</span>
                  ) : (
                    <span className="text-gray-400">×1</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    membre.actif ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'
                  }`}>{membre.actif ? 'Actif' : 'Inactif'}</span>
                </td>
                {peutModifier && (
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {peutEditer && <button onClick={() => startEdit(membre)} className="text-primary-600 text-xs font-medium px-2 py-1 rounded hover:bg-primary-50">Modifier</button>}
                      {peutToggle && <button onClick={() => toggleActif(membre)} className="text-warning-600 text-xs font-medium px-2 py-1 rounded hover:bg-warning-50">{membre.actif ? 'Désactiver' : 'Activer'}</button>}
                      {peutSupprimerM && <button onClick={() => supprimerMembre(membre)} className="text-danger-600 text-xs font-medium px-2 py-1 rounded hover:bg-danger-50">Supprimer</button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {membresFiltres.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">{search ? 'Aucun résultat' : 'Aucun membre inscrit'}</div>
        )}
      </div>

      {/* Vue cartes mobile */}
      <div className="sm:hidden space-y-2">
        {membresFiltres.map((membre, idx) => (
          <div key={membre.id} className="card py-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-6">{membre.numero_ordre || idx + 1}</span>
                <div>
                  <h3 className="font-medium text-sm text-gray-900">{membre.nom}</h3>
                  {membre.contact && <p className="text-xs text-gray-500">{membre.contact}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">×{membre.nombre_bras || 1} bras</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                membre.actif ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'
              }`}>{membre.actif ? 'Actif' : 'Inactif'}</span>
            </div>
            {peutModifier && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t">
                {peutEditer && <button onClick={() => startEdit(membre)} className="text-primary-600 text-xs font-medium">Modifier</button>}
                {peutToggle && <button onClick={() => toggleActif(membre)} className="text-warning-600 text-xs font-medium">{membre.actif ? 'Désactiver' : 'Activer'}</button>}
                {peutSupprimerM && <button onClick={() => supprimerMembre(membre)} className="text-danger-600 text-xs font-medium">Supprimer</button>}
              </div>
            )}
          </div>
        ))}
        {membresFiltres.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">{search ? 'Aucun résultat' : 'Aucun membre inscrit'}</div>
        )}
      </div>
    </div>
  )
}
