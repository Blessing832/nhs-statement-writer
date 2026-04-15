'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAdminToken } from '@/lib/admin-context'

interface StatementRow {
  id: string
  job_title: string
  organisation: string
  vacancy_url: string
  created_at: string
  client: { id: string; client_code: string; full_name: string } | null
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function StatementsPage() {
  const { token } = useAdminToken()
  const [statements, setStatements] = useState<StatementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchStatements = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/statements?limit=100', {
      headers: { 'x-admin-token': token },
    })
    if (res.ok) setStatements(await res.json())
    setLoading(false)
  }, [token])

  useEffect(() => { fetchStatements() }, [fetchStatements])

  const filtered = statements.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.job_title.toLowerCase().includes(q) ||
      s.organisation.toLowerCase().includes(q) ||
      s.client?.full_name.toLowerCase().includes(q) ||
      s.client?.client_code.toLowerCase().includes(q)
    )
  })

  // Group by date
  const grouped = filtered.reduce<Record<string, StatementRow[]>>((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(s)
    return acc
  }, {})

  // Stats
  const today = new Date().toDateString()
  const thisWeek = statements.filter((s) => {
    const d = new Date(s.created_at)
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  }).length

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Statements</p>
          <p className="text-3xl font-bold" style={{ color: '#003087' }}>{statements.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">This Week</p>
          <p className="text-3xl font-bold" style={{ color: '#005eb8' }}>{thisWeek}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Today</p>
          <p className="text-3xl font-bold" style={{ color: '#009639' }}>
            {statements.filter((s) => new Date(s.created_at).toDateString() === today).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by candidate, job title, or organisation…"
          className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
        />
        <span className="text-xs text-gray-400">{filtered.length} of {statements.length} statements</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#005eb8' }} />
          <span className="text-sm">Loading statements…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-gray-500">
          {search ? 'No statements match your search.' : 'No statements generated yet.'}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, rows]) => (
            <div key={date}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{date}</h3>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {rows.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-4 px-5 py-3.5 ${i < rows.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-gray-50`}
                  >
                    {/* Candidate avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: '#005eb8' }}
                    >
                      {s.client?.full_name?.charAt(0).toUpperCase() || '?'}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {s.job_title || 'Untitled Role'}
                        </span>
                        {s.organisation && (
                          <span className="text-xs text-gray-500 truncate">{s.organisation}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">{s.client?.full_name || 'Unknown'}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs font-mono text-gray-400">{s.client?.client_code}</span>
                      </div>
                    </div>

                    {/* Time + link */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">{timeAgo(s.created_at)}</span>
                      {s.vacancy_url && (
                        <a
                          href={s.vacancy_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View job
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
