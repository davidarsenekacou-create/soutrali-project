'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function NouvelleTontinePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nom: '',
    description: '',
    montant_journalier: 2750,
    date_debut: '',
    date_fin: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('tontines')
        .insert({
          nom: form.nom,
          description: form.description || null,
          montant_journalier: form.montant_journalier,
          date_debut: form.date_debut,
          date_fin: form.date_fin,
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Tontine créée avec succès !')
      router.push(`/tontines/${data.id}`)
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <Link href="/tontines" className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block">
          &larr; Retour aux tontines
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouvelle tontine</h1>
        <p className="text-gray-500 text-sm mt-1">Créez un nouveau groupe de tontine</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label-field">Nom de la tontine *</label>
          <input
            type="text"
            required
            className="input-field"
            placeholder="Ex: TONTINE SOUTRALI BENEDICTION"
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
        </div>

        <div>
          <label className="label-field">Description</label>
          <textarea
            className="input-field"
            rows={3}
            placeholder="Description optionnelle..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <label className="label-field">Montant de la cotisation journalière (FCFA) *</label>
          <input
            type="number"
            required
            min={100}
            className="input-field"
            value={form.montant_journalier}
            onChange={(e) => setForm({ ...form, montant_journalier: Number(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Date de début *</label>
            <input
              type="date"
              required
              className="input-field"
              value={form.date_debut}
              onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
            />
          </div>
          <div>
            <label className="label-field">Date de fin *</label>
            <input
              type="date"
              required
              className="input-field"
              value={form.date_fin}
              onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link href="/tontines" className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Création...' : 'Créer la tontine'}
          </button>
        </div>
      </form>
    </div>
  )
}
