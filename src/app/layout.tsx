import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import AppShell from '@/components/layout/AppShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SOUTRALI BENEDICTION - Gestion de Tontines',
  description: 'Plateforme de gestion de tontines journalières',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Toaster position="top-right" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
