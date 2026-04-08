'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { AuthProvider, useAuth } from '@/lib/auth'
import Sidebar from './Sidebar'

function MobileHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-primary-900 text-white flex items-center justify-between px-4 z-30">
      <button onClick={onMenuToggle} className="text-white p-1">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-warning-500 rounded-lg flex items-center justify-center font-bold text-primary-900 text-xs">
          S
        </div>
        <span className="font-bold text-sm">SOUTRALI</span>
      </div>
      <div className="w-6" /> {/* Spacer pour centrer le logo */}
    </header>
  )
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { utilisateur, loading } = useAuth()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Page login : pas de sidebar
  if (pathname === '/login') {
    return <>{children}</>
  }

  // En cours de chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  // Non connecté : rediriger vers login
  if (!utilisateur) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  // Gérante : bloquer l'accès aux pages non autorisées
  if (utilisateur.role === 'gerante' && !pathname.startsWith('/tontines')) {
    if (typeof window !== 'undefined') {
      window.location.href = '/tontines'
    }
    return null
  }

  return (
    <div className="flex min-h-screen">
      <MobileHeader onMenuToggle={() => setMobileOpen(!mobileOpen)} />
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="flex-1 lg:ml-64">
        <div className="p-3 pt-[4.5rem] sm:p-4 sm:pt-[4.5rem] lg:p-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  )
}
