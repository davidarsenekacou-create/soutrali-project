'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { Utilisateur } from './types'

interface AuthContextType {
  utilisateur: Utilisateur | null
  loading: boolean
  tontineIds: string[] // IDs des tontines gérées (pour les gérantes)
  isAdmin: boolean
  isResponsable: boolean
  peutModifier: boolean // admin peut modifier, responsable et gérante non (sauf gérante sur ses tontines)
  login: (loginStr: string, motDePasse: string) => Promise<{ error?: string; role?: string }>
  logout: () => void
  peutAccederTontine: (tontineId: string) => boolean
}

const AuthContext = createContext<AuthContextType>({
  utilisateur: null,
  loading: true,
  tontineIds: [],
  isAdmin: false,
  isResponsable: false,
  peutModifier: false,
  login: async () => ({}),
  logout: () => {},
  peutAccederTontine: () => false,
})

export function useAuth() {
  return useContext(AuthContext)
}

// Hash SHA-256 côté client
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [tontineIds, setTontineIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const isAdmin = utilisateur?.role === 'admin'
  const isResponsable = utilisateur?.role === 'responsable'
  const peutModifier = isAdmin // seul l'admin peut créer/modifier/supprimer

  // Restaurer la session au chargement
  useEffect(() => {
    const stored = localStorage.getItem('soutrali_user')
    if (stored) {
      try {
        const user = JSON.parse(stored) as Utilisateur
        setUtilisateur(user)
        if (user.role === 'gerante') {
          loadTontineIds(user.id)
        }
      } catch {
        localStorage.removeItem('soutrali_user')
      }
    }
    setLoading(false)
  }, [])

  async function loadTontineIds(userId: string) {
    const { data } = await supabase
      .from('tontine_gerantes')
      .select('tontine_id')
      .eq('utilisateur_id', userId)

    setTontineIds((data || []).map((d) => d.tontine_id))
  }

  async function login(loginStr: string, motDePasse: string): Promise<{ error?: string; role?: string }> {
    const hash = await hashPassword(motDePasse)

    const { data, error } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('login', loginStr)
      .eq('mot_de_passe', hash)
      .eq('actif', true)
      .single()

    if (error || !data) {
      return { error: 'Identifiant ou mot de passe incorrect' }
    }

    const user = data as Utilisateur
    setUtilisateur(user)
    localStorage.setItem('soutrali_user', JSON.stringify(user))

    if (user.role === 'gerante') {
      await loadTontineIds(user.id)
    } else {
      setTontineIds([])
    }

    return { role: user.role }
  }

  function logout() {
    setUtilisateur(null)
    setTontineIds([])
    localStorage.removeItem('soutrali_user')
  }

  function peutAccederTontine(tontineId: string): boolean {
    if (isAdmin || isResponsable) return true
    return tontineIds.includes(tontineId)
  }

  return (
    <AuthContext.Provider value={{ utilisateur, loading, tontineIds, isAdmin, isResponsable, peutModifier, login, logout, peutAccederTontine }}>
      {children}
    </AuthContext.Provider>
  )
}
