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
          <div style={{ width: 40, height: 40, border: '2px solid #F4A800', borderRadius: '50%', position: 'relative', marginBottom: 16 }}>
            <div style={{ position: 'absolute', top: '50%', left: '18%', right: '18%', height: 2, background: '#072f42', transform: 'translateY(-50%)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '18%', bottom: '18%', width: 2, background: '#F4A800', transform: 'translateX(-50%)' }} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">EaseMe: NHS Careers Platform</p>
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
            style={{ backgroundColor: '#0B4F6C' }}
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
  { label: 'Home',           href: '/admin', exact: true },
  { label: 'Candidates',     href: '/admin/candidates' },
  { label: 'Vacancies',      href: '/admin/vacancies' },
  { label: 'Statements',     href: '/admin/statements' },
  { label: 'Quick Write',    href: '/admin/quick-write' },
  { label: 'Interview Prep', href: '/admin/interview-prep' },
  { label: 'Prompts',        href: '/admin/prompts' },
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
        <header style={{ backgroundColor: '#072f42' }} className="py-3 px-6 shadow-md">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ width: 30, height: 30, border: '2px solid #F4A800', borderRadius: '50%', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '50%', left: '18%', right: '18%', height: 2, background: '#fff', transform: 'translateY(-50%)' }} />
                <div style={{ position: 'absolute', left: '50%', top: '18%', bottom: '18%', width: 2, background: '#F4A800', transform: 'translateX(-50%)' }} />
              </div>
              <div>
                <span style={{ fontFamily: "var(--font-fraunces), 'Fraunces', serif", fontWeight: 700, color: '#fff', fontSize: 18 }}>
                  Ease<span style={{ color: '#F4A800' }}>Me</span>
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }} className="ml-1.5 hidden sm:inline font-medium">Admin</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/"
                className="px-3 py-1.5 text-xs hover:text-white transition-colors"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                ← Client Portal
              </a>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 text-xs text-white border border-white/25 rounded-md hover:bg-white/10 cursor-pointer transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Tab bar */}
        <div style={{ backgroundColor: '#0B4F6C' }} className="px-6 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-end gap-0.5 overflow-x-auto">
            {TABS.map((tab) => {
              const active = isActive(tab.href, tab.exact)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                    active
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/15'
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
            style={{ borderTopColor: '#0B4F6C' }}
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
