'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Client } from '@/lib/types'

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
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
          <p className="text-sm text-gray-600 mt-1">Statement Writer Dashboard</p>
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
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-white font-semibold rounded-md cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: '#005eb8' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center mt-4">
          <a href="/" className="text-sm text-blue-700 hover:underline">← Back to client portal</a>
        </p>
      </div>
    </main>
  )
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchClients = async () => {
    setLoading(true)
    const res = await fetch('/api/clients', {
      headers: { 'x-admin-token': token },
    })
    if (res.ok) {
      const data = await res.json()
      setClients(data)
    }
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [])

  const handleDelete = async (client: Client) => {
    if (!confirm(`Delete ${client.full_name} (${client.client_code})? This cannot be undone.`)) return
    setDeleting(client.id)
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token },
    })
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== client.id))
    }
    setDeleting(null)
  }

  const isExpired = (client: Client) => new Date() > new Date(client.subscription_end)

  const filtered = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.client_code.toLowerCase().includes(search.toLowerCase())
  )

  const active = filtered.filter((c) => c.is_active && !isExpired(c))
  const expired = filtered.filter((c) => !c.is_active || isExpired(c))

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f4f5' }}>
      <header style={{ backgroundColor: '#003087' }} className="py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded flex items-center justify-center"
              style={{ backgroundColor: '#005eb8' }}
            >
              <span className="text-white font-bold text-sm">NHS</span>
            </div>
            <h1 className="text-white text-xl font-semibold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/vacancies"
              className="px-4 py-2 text-sm font-medium text-white border border-white border-opacity-40 rounded-md hover:bg-white hover:bg-opacity-10"
            >
              Vacancy Monitor
            </Link>
            <Link
              href="/admin/clients/new"
              className="px-4 py-2 text-sm font-medium text-white rounded-md"
              style={{ backgroundColor: '#009639' }}
            >
              + Add Client
            </Link>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm font-medium text-white border border-white border-opacity-40 rounded-md hover:bg-white hover:bg-opacity-10 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <div style={{ backgroundColor: '#005eb8' }} className="h-2" />

      <div className="max-w-5xl mx-auto w-full px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-500">Total Clients</p>
            <p className="text-3xl font-bold text-gray-900">{clients.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-3xl font-bold" style={{ color: '#009639' }}>
              {clients.filter((c) => c.is_active && !isExpired(c)).length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-500">Expired / Inactive</p>
            <p className="text-3xl font-bold text-red-500">
              {clients.filter((c) => !c.is_active || isExpired(c)).length}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or client code..."
            className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {loading ? (
          <p className="text-gray-500">Loading clients...</p>
        ) : (
          <>
            {/* Active clients */}
            {active.length > 0 && (
              <ClientTable
                title="Active Clients"
                clients={active}
                token={token}
                onDelete={handleDelete}
                deleting={deleting}
              />
            )}

            {/* Expired/inactive */}
            {expired.length > 0 && (
              <div className="mt-6">
                <ClientTable
                  title="Expired / Inactive"
                  clients={expired}
                  token={token}
                  onDelete={handleDelete}
                  deleting={deleting}
                  dimmed
                />
              </div>
            )}

            {filtered.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                No clients found.{' '}
                <Link href="/admin/clients/new" className="text-blue-700 hover:underline">
                  Add the first one
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function ClientTable({
  title,
  clients,
  token,
  onDelete,
  deleting,
  dimmed = false,
}: {
  title: string
  clients: Client[]
  token: string
  onDelete: (c: Client) => void
  deleting: string | null
  dimmed?: boolean
}) {
  return (
    <div className={dimmed ? 'opacity-70' : ''}>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }} className="border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Client Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const expired = new Date() > new Date(c.subscription_end)
              return (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.full_name}</td>
                  <td className="px-4 py-3 font-mono tracking-wider text-gray-700">{c.client_code}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(c.subscription_end).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    {!c.is_active ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Disabled</span>
                    ) : expired ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Expired</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => onDelete(c)}
                        disabled={deleting === c.id}
                        className="px-3 py-1 text-xs border border-red-200 rounded hover:bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
                      >
                        {deleting === c.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminPage() {
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

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setToken(null)
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f4f5' }}>
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" style={{ borderTopColor: '#005eb8' }} />
          <span>Verifying session...</span>
        </div>
      </div>
    )
  }

  if (!token) return <AdminLogin onLogin={setToken} />
  return <AdminDashboard token={token} onLogout={handleLogout} />
}
