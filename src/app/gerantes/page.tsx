'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Utilisateur, Tontine, PERMISSION_GROUPS, ALL_PERMISSIONS } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'

interface UtilisateurAvecTontines extends Utilisateur {
  tontines: { id: string; tontine_id: string; tontine_nom: string }[]
}

// Hash SHA-256
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function GerantesPage() {
  const { isAdmin } = useAuth()
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurAvecTontines[]>([])
  const [tontines, setTontines] = useState<Tontine[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nom: '',
    login: '',
    motDePasse: '',
    role: 'gerante' as 'admin' | 'responsable' | 'gerante',
  })

  // Attribution tontines
  const [showAttribution, setShowAttribution] = useState<string | null>(null)
  const [tontineSelectionnee, setTontineSelectionnee] = useState('')

  // Panneau des permissions
  const [showPermissions, setShowPermissions] = useState<string | null>(null)
  const [savingPerms, setSavingPerms] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [{ data: usersData }, { data: tontinesData }] = await Promise.all([
        supabase.from('utilisateurs').select('*').order('role').order('nom'),
        supabase.from('tontines').select('*').eq('actif', true).order('nom'),
      ])

      // Charger les attributions
      const { data: attributions } = await supabase
        .from('tontine_gerantes')
        .select('*, tontines(nom)')

      const users: UtilisateurAvecTontines[] = (usersData || []).map((u: any) => ({
        ...u,
        tontines: (attributions || [])
          .filter((a: any) => a.utilisateur_id === u.id)
          .map((a: any) => ({
            id: a.id,
            tontine_id: a.tontine_id,
            tontine_nom: a.tontines?.nom || '',
          })),
      }))

      setUtilisateurs(users)
      setTontines(tontinesData || [])
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const hash = await hashPassword(form.motDePasse)

      if (editingId) {
        const payload: any = {
          nom: form.nom.trim(),
          login: form.login.trim(),
          role: form.role,
        }
        // Ne changer le mot de passe que s'il est renseigné
        if (form.motDePasse.trim()) {
          payload.mot_de_passe = hash
        }

        const { error } = await supabase
          .from('utilisateurs')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error
        toast.success('Compte mis à jour')
      } else {
        if (!form.motDePasse.trim()) {
          toast.error('Le mot de passe est obligatoire')
          return
        }

        // Permissions par défaut selon le rôle
        const defaultPerms = form.role === 'admin'
          ? ALL_PERMISSIONS
          : form.role === 'responsable'
            ? ['view.dashboard', 'view.tontines', 'view.comptes', 'view.gerantes', 'view.statistiques']
            : ['view.tontines', 'cotisations.cocher', 'prises.create']

        const { error } = await supabase.from('utilisateurs').insert({
          nom: form.nom.trim(),
          login: form.login.trim(),
          mot_de_passe: hash,
          role: form.role,
          permissions: defaultPerms,
        })
        if (error) throw error
        toast.success('Compte créé')
      }

      resetForm()
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Erreur')
    }
  }

  function resetForm() {
    setForm({ nom: '', login: '', motDePasse: '', role: 'gerante' })
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(user: Utilisateur) {
    setEditingId(user.id)
    setForm({
      nom: user.nom,
      login: user.login,
      motDePasse: '',
      role: user.role,
    })
    setShowForm(true)
  }

  async function toggleActif(user: Utilisateur) {
    await supabase.from('utilisateurs').update({ actif: !user.actif }).eq('id', user.id)
    toast.success(user.actif ? 'Compte désactivé' : 'Compte activé')
    loadData()
  }

  async function supprimer(user: Utilisateur) {
    if (!confirm(`Supprimer le compte de ${user.nom} ?`)) return
    await supabase.from('utilisateurs').delete().eq('id', user.id)
    toast.success('Compte supprimé')
    loadData()
  }

  // Attribution de tontine
  async function attribuerTontine(utilisateurId: string) {
    if (!tontineSelectionnee) return

    try {
      const { error } = await supabase.from('tontine_gerantes').insert({
        tontine_id: tontineSelectionnee,
        utilisateur_id: utilisateurId,
      })
      if (error) throw error
      toast.success('Tontine attribuée')
      setTontineSelectionnee('')
      loadData()
    } catch (error: any) {
      toast.error(error.message?.includes('unique') ? 'Déjà attribuée' : error.message || 'Erreur')
    }
  }

  // Permissions
  async function togglePermission(user: UtilisateurAvecTontines, key: string) {
    setSavingPerms(true)
    const current = user.permissions || []
    const next = current.includes(key) ? current.filter((p) => p !== key) : [...current, key]
    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ permissions: next })
        .eq('id', user.id)
      if (error) throw error
      // Mise à jour optimiste
      setUtilisateurs((prev) => prev.map((u) => (u.id === user.id ? { ...u, permissions: next } : u)))
    } catch (e: any) {
      toast.error(e.message || 'Erreur')
    } finally {
      setSavingPerms(false)
    }
  }

  async function setAllPermissions(user: UtilisateurAvecTontines, all: boolean) {
    setSavingPerms(true)
    const next = all ? [...ALL_PERMISSIONS] : []
    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ permissions: next })
        .eq('id', user.id)
      if (error) throw error
      setUtilisateurs((prev) => prev.map((u) => (u.id === user.id ? { ...u, permissions: next } : u)))
      toast.success(all ? 'Toutes les permissions accordées' : 'Toutes les permissions retirées')
    } catch (e: any) {
      toast.error(e.message || 'Erreur')
    } finally {
      setSavingPerms(false)
    }
  }

  async function retirerTontine(attributionId: string) {
    if (!confirm('Retirer cette attribution ?')) return
    await supabase.from('tontine_gerantes').delete().eq('id', attributionId)
    toast.success('Attribution retirée')
    loadData()
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Accès réservé aux administrateurs</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestion des comptes</h1>
          <p className="text-gray-500 text-sm mt-1">Comptes administrateurs, responsables et gérantes</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary text-sm self-start sm:self-auto">
          + Nouveau compte
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-4">
            {editingId ? 'Modifier le compte' : 'Nouveau compte'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="label-field">Nom complet *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Ex: DIARRA OUMOU"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">Identifiant *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Ex: oumou"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">
                Mot de passe {editingId ? '(laisser vide = inchangé)' : '*'}
              </label>
              <input
                type="password"
                required={!editingId}
                className="input-field"
                placeholder="********"
                value={form.motDePasse}
                onChange={(e) => setForm({ ...form, motDePasse: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">Rôle *</label>
              <select
                className="input-field"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'responsable' | 'gerante' })}
              >
                <option value="gerante">Gérante</option>
                <option value="responsable">Responsable</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="btn-primary text-sm">
                {editingId ? 'Mettre à jour' : 'Créer'}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des utilisateurs */}
      <div className="space-y-4">
        {utilisateurs.map((user) => (
          <div key={user.id} className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  user.role === 'admin' ? 'bg-primary-600' : user.role === 'responsable' ? 'bg-success-600' : 'bg-warning-500'
                }`}>
                  {user.nom.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{user.nom}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-primary-100 text-primary-700'
                        : user.role === 'responsable'
                          ? 'bg-success-50 text-success-700'
                          : 'bg-warning-50 text-warning-700'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : user.role === 'responsable' ? 'Responsable' : 'Gérante'}
                    </span>
                    {!user.actif && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Inactif
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">Identifiant : {user.login}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button onClick={() => startEdit(user)} className="text-primary-600 text-xs font-medium px-2 py-1 rounded hover:bg-primary-50">
                  Modifier
                </button>
                <button onClick={() => toggleActif(user)} className="text-warning-600 text-xs font-medium px-2 py-1 rounded hover:bg-warning-50">
                  {user.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => supprimer(user)} className="text-danger-600 text-xs font-medium px-2 py-1 rounded hover:bg-danger-50">
                  Supprimer
                </button>
                {user.role === 'gerante' && (
                  <button
                    onClick={() => setShowAttribution(showAttribution === user.id ? null : user.id)}
                    className="btn-secondary text-xs ml-2"
                  >
                    {showAttribution === user.id ? 'Fermer' : 'Tontines'}
                  </button>
                )}
                {user.role !== 'admin' && (
                  <button
                    onClick={() => setShowPermissions(showPermissions === user.id ? null : user.id)}
                    className="btn-secondary text-xs"
                  >
                    {showPermissions === user.id ? 'Fermer' : 'Permissions'}
                  </button>
                )}
              </div>
            </div>

            {/* Panneau permissions */}
            {showPermissions === user.id && user.role !== 'admin' && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700">Permissions de {user.nom}</h4>
                    <p className="text-xs text-gray-400">Cochez ce que ce compte est autorisé à faire dans l'application</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={savingPerms}
                      onClick={() => setAllPermissions(user, true)}
                      className="text-xs font-medium text-success-700 hover:underline"
                    >
                      Tout cocher
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      disabled={savingPerms}
                      onClick={() => setAllPermissions(user, false)}
                      className="text-xs font-medium text-danger-600 hover:underline"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.titre} className="border border-gray-200 rounded-lg p-3">
                      <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{group.titre}</h5>
                      <div className="space-y-1.5">
                        {group.permissions.map((perm) => {
                          const checked = (user.permissions || []).includes(perm.key)
                          return (
                            <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={savingPerms}
                                onChange={() => togglePermission(user, perm.key)}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-gray-700">{perm.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attribution de tontines (gérantes uniquement) */}
            {showAttribution === user.id && user.role === 'gerante' && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Tontines gérées</h4>

                {/* Tontines attribuées */}
                {user.tontines.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {user.tontines.map((t) => (
                      <div key={t.id} className="flex items-center justify-between bg-success-50 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium text-success-800">{t.tontine_nom}</span>
                        <button
                          onClick={() => retirerTontine(t.id)}
                          className="text-danger-500 text-xs font-medium hover:underline"
                        >
                          Retirer
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mb-4">Aucune tontine attribuée</p>
                )}

                {/* Ajouter une tontine */}
                <div className="flex items-center gap-2">
                  <select
                    className="input-field text-sm flex-1"
                    value={tontineSelectionnee}
                    onChange={(e) => setTontineSelectionnee(e.target.value)}
                  >
                    <option value="">— Attribuer une tontine —</option>
                    {tontines
                      .filter((t) => !user.tontines.some((ut) => ut.tontine_id === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.nom}</option>
                      ))}
                  </select>
                  <button
                    onClick={() => attribuerTontine(user.id)}
                    disabled={!tontineSelectionnee}
                    className="btn-primary text-sm"
                  >
                    Attribuer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {utilisateurs.length === 0 && (
          <div className="card text-center py-16">
            <p className="text-gray-500">Aucun compte créé</p>
          </div>
        )}
      </div>
    </div>
  )
}
