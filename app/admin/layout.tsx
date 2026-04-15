'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AdminContext } from '@/lib/admin-context'

// ── Login form ────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      localStorage.setItem('admin_token', data.token)
      onLogin(data.token)
    } else {
      setError(data.error || 'Invalid password')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#f0f4f5' }}>
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <div
            className="w-12 h-12 rounded flex items-center justify-center mb-4"
            style={{ backgroundColor: '#003087' }}
          >
            <span className="text-white font-bold">NHS</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">EaseMe — NHS Careers Platform</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Admin password"
              disabled={loading}
              autoFocus
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-white font-semibold rounded-md cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: '#005eb8' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center mt-4">
          <a href="/" className="text-sm text-blue-700 hover:underline">← Client portal</a>
        </p>
      </div>
    </main>
  )
}

// ── Tab navigation ────────────────────────────────────────────────────────────
const TABS = [
  { label: 'Home',        href: '/admin', exact: true },
  { label: 'Candidates',  href: '/admin/candidates' },
  { label: 'Vacancies',   href: '/admin/vacancies' },
  { label: 'Statements',  href: '/admin/statements' },
  { label: 'Quick Write', href: '/admin/quick-write' },
]

function AdminShell({
  token,
  onLogout,
  children,
}: {
  token: string
  onLogout: () => void
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <AdminContext.Provider value={{ token, onLogout }}>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f4f5' }}>
        {/* Top header */}
        <header style={{ backgroundColor: '#003087' }} className="py-3 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded flex items-center justify-center"
                style={{ backgroundColor: '#005eb8' }}
              >
                <span className="text-white font-bold text-xs">NHS</span>
              </div>
              <div>
                <span className="text-white font-semibold text-base">EaseMe Admin</span>
                <span className="text-blue-300 text-xs ml-2 hidden sm:inline">easeme.live</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/"
                className="px-3 py-1.5 text-xs text-white border border-white border-opacity-30 rounded hover:bg-white hover:bg-opacity-10"
              >
                Client Portal
              </a>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 text-xs text-white border border-white border-opacity-30 rounded hover:bg-white hover:bg-opacity-10 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Tab bar */}
        <div style={{ backgroundColor: '#005eb8' }} className="px-6">
          <div className="max-w-5xl mx-auto flex items-end gap-1">
            {TABS.map((tab) => {
              const active = isActive(tab.href, tab.exact)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-5 py-2.5 text-sm font-medium rounded-t-md transition-colors ${
                    active
                      ? 'bg-white text-gray-900'
                      : 'text-white hover:bg-white hover:bg-opacity-15'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </AdminContext.Provider>
  )
}

// ── Root layout ────────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('admin_token')
    if (!stored) {
      setVerifying(false)
      return
    }
    fetch('/api/admin/verify', { headers: { 'x-admin-token': stored } })
      .then((r) => {
        if (r.ok) setToken(stored)
        else localStorage.removeItem('admin_token')
      })
      .catch(() => localStorage.removeItem('admin_token'))
      .finally(() => setVerifying(false))
  }, [])

  const handleLogin = (t: string) => setToken(t)

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setToken(null)
    router.push('/admin')
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f4f5' }}>
        <div className="flex items-center gap-3 text-gray-500">
          <div
            className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin"
            style={{ borderTopColor: '#005eb8' }}
          />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />

  return (
    <AdminShell token={token} onLogout={handleLogout}>
      {children}
    </AdminShell>
  )
}
