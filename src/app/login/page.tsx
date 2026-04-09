'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ login: '', motDePasse: '' })
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    setLoading(true)

    const result = await login(form.login, form.motDePasse)
    if (result.error) {
      setErreur(result.error)
      setLoading(false)
    } else {
      // Rediriger vers la racine — AppShell redirige vers la première page autorisée si besoin
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-primary-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-warning-500 rounded-2xl flex items-center justify-center font-bold text-primary-900 text-2xl mx-auto mb-4">
            S
          </div>
          <h1 className="text-2xl font-bold text-white">SOUTRALI</h1>
          <p className="text-primary-300 text-sm">BENEDICTION</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl p-8 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Connexion</h2>
            <p className="text-sm text-gray-500">Connectez-vous pour accéder à la plateforme</p>
          </div>

          {erreur && (
            <div className="bg-danger-50 text-danger-700 text-sm px-4 py-3 rounded-lg">
              {erreur}
            </div>
          )}

          <div>
            <label className="label-field">Identifiant</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="Votre identifiant"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              autoFocus
            />
          </div>

          <div>
            <label className="label-field">Mot de passe</label>
            <input
              type="password"
              required
              className="input-field"
              placeholder="Votre mot de passe"
              value={form.motDePasse}
              onChange={(e) => setForm({ ...form, motDePasse: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-center"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-primary-400 text-xs mt-6">
          Tontine Manager v1.0
        </p>
      </div>
    </div>
  )
}
