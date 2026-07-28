'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAdminToken } from '@/lib/admin-context'
import type { Client } from '@/lib/types'
import type { ApplicantPreferences } from '@/lib/vacancy/types'

function StatusBadge({ client }: { client: Client }) {
  const expired = new Date() > new Date(client.subscription_end)
  if (!client.is_active)
    return <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">Disabled</span>
  if (expired)
    return <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Expired</span>
  return <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Active</span>
}

export default function CandidatesPage() {
  const { token } = useAdminToken()
  const [clients, setClients] = useState<Client[]>([])
  const [prefs, setPrefs] = useState<ApplicantPreferences[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [clientsRes, prefsRes] = await Promise.all([
      fetch('/api/clients', { headers: { 'x-admin-token': token } }),
      fetch('/api/vacancies/preferences', { headers: { 'x-admin-token': token } }),
    ])
    if (clientsRes.ok) setClients(await clientsRes.json())
    if (prefsRes.ok) setPrefs(await prefsRes.json())
    setLoading(false)
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (client: Client) => {
    if (!confirm(`Delete ${client.full_name} (${client.client_code})? This cannot be undone.`)) return
    setDeleting(client.id)
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token },
    })
    if (res.ok) setClients((prev) => prev.filter((c) => c.id !== client.id))
    setDeleting(null)
  }

  const prefMap = new Map(prefs.map((p) => [p.client_id, p]))

  const filtered = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.client_code.toLowerCase().includes(search.toLowerCase())
  )

  const active = filtered.filter((c) => c.is_active && new Date() <= new Date(c.subscription_end))
  const expired = filtered.filter((c) => !c.is_active || new Date() > new Date(c.subscription_end))

  const stats = {
    total: clients.length,
    active: clients.filter((c) => c.is_active && new Date() <= new Date(c.subscription_end)).length,
    monitored: prefs.length,
    expired: clients.filter((c) => !c.is_active || new Date() > new Date(c.subscription_end)).length,
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Candidates', value: stats.total, color: '#072f42' },
          { label: 'Active', value: stats.active, color: '#009639' },
          { label: 'Vacancy Alerts On', value: stats.monitored, color: '#0B4F6C' },
          { label: 'Expired / Inactive', value: stats.expired, color: '#d5281b' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code…"
          className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <div className="flex gap-2">
          <Link
            href="/admin/vacancies/preferences"
            className="px-4 py-2 text-sm font-medium border rounded-md text-gray-700 border-gray-300 hover:bg-gray-50"
          >
            Manage Vacancy Alerts
          </Link>
          <Link
            href="/admin/clients/new"
            className="px-4 py-2 text-sm font-semibold text-white rounded-md"
            style={{ backgroundColor: '#009639' }}
          >
            + Add Candidate
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#0B4F6C' }} />
          <span className="text-sm">Loading candidates…</span>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <CandidateTable
              title="Active Candidates"
              clients={active}
              prefMap={prefMap}
              onDelete={handleDelete}
              deleting={deleting}
            />
          )}

          {expired.length > 0 && (
            <div className="mt-6 opacity-70">
              <CandidateTable
                title="Expired / Inactive"
                clients={expired}
                prefMap={prefMap}
                onDelete={handleDelete}
                deleting={deleting}
              />
            </div>
          )}

          {filtered.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-gray-500">
              No candidates found.{' '}
              <Link href="/admin/clients/new" className="text-blue-700 hover:underline">Add the first one</Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CandidateTable({
  title,
  clients,
  prefMap,
  onDelete,
  deleting,
}: {
  title: string
  clients: Client[]
  prefMap: Map<string, ApplicantPreferences>
  onDelete: (c: Client) => void
  deleting: string | null
}) {
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }} className="border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vacancy Alert</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const pref = prefMap.get(c.id)
              return (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.full_name}</td>
                  <td className="px-4 py-3 font-mono text-xs tracking-wider text-gray-600">{c.client_code}</td>
                  <td className="px-4 py-3">
                    {pref ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        {pref.role_keywords.slice(0, 2).join(', ')}
                        {pref.role_keywords.length > 2 && ` +${pref.role_keywords.length - 2}`}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not set up</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(c.subscription_end).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3"><StatusBadge client={c} /></td>
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
                        {deleting === c.id ? '…' : 'Delete'}
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
