'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAdminToken } from '@/lib/admin-context'
import type { DashboardData, Vacancy } from '@/lib/vacancy/types'

const SOURCE_LABELS: Record<string, string> = {
  england: 'NHS England',
  scotland: 'NHS Scotland',
  'civil-service': 'Civil Service',
  healthjobsuk: 'HealthJobsUK',
}

const SOURCE_COLORS: Record<string, string> = {
  england: '#005eb8',
  scotland: '#003087',
  'civil-service': '#4c2c92',
  healthjobsuk: '#009639',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))

  if (diffMs < 0) return 'Closed'
  if (diffHours < 24) return `Closes in ${diffHours}h`
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 7) return `Closes in ${diffDays}d`
  return `Closes ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

function formatPosted(iso: string | null): string {
  if (!iso) return 'Posted: unknown'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'Just posted'
  if (diffHours < 24) return `Posted ${diffHours}h ago`
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return `Posted ${diffDays}d ago`
}

function ClosingBadge({ closesAt }: { closesAt: string | null }) {
  if (!closesAt) return null
  const d = new Date(closesAt)
  const now = new Date()
  const diffHours = (d.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (diffHours < 0) return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Closed</span>
  )
  if (diffHours < 12) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      Closes in {Math.round(diffHours)}h — URGENT
    </span>
  )
  if (diffHours < 48) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
      {formatDate(closesAt)}
    </span>
  )
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      {formatDate(closesAt)}
    </span>
  )
}

function VacancyCard({
  matchId,
  vacancy,
  token,
  onDone,
}: {
  matchId: string
  vacancy: Vacancy
  token: string
  onDone: (matchId: string) => void
}) {
  const [marking, setMarking] = useState(false)

  const handleDone = async () => {
    if (!confirm(`Mark "${vacancy.title}" as done for this applicant?`)) return
    setMarking(true)
    const res = await fetch(`/api/vacancies/${matchId}/done`, {
      method: 'POST',
      headers: { 'x-admin-token': token },
    })
    if (res.ok) onDone(matchId)
    else setMarking(false)
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded text-white"
            style={{ backgroundColor: SOURCE_COLORS[vacancy.source] || '#333' }}
          >
            {SOURCE_LABELS[vacancy.source] || vacancy.source}
          </span>
          {vacancy.band && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
              {vacancy.band}
            </span>
          )}
          {vacancy.employment_type && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {vacancy.employment_type}
            </span>
          )}
          <ClosingBadge closesAt={vacancy.closes_at} />
        </div>
        <a
          href={vacancy.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-900 hover:text-blue-700 hover:underline text-sm leading-snug"
        >
          {vacancy.title}
        </a>
        <div className="text-xs text-gray-500 mt-0.5">
          {vacancy.organisation && <span>{vacancy.organisation}</span>}
          {vacancy.organisation && vacancy.location && <span> · </span>}
          {vacancy.location && <span>{vacancy.location}</span>}
          <span className="ml-2 text-gray-400">{formatPosted(vacancy.posted_at)}</span>
        </div>
      </div>
      <button
        onClick={handleDone}
        disabled={marking}
        className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer disabled:opacity-50 transition-colors"
        style={{ borderColor: '#009639', color: '#009639' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#009639'
          e.currentTarget.style.color = 'white'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = '#009639'
        }}
      >
        {marking ? '...' : 'Done'}
      </button>
    </div>
  )
}

function ApplicantCard({
  applicant,
  token,
  onMatchDone,
}: {
  applicant: DashboardData['needs_action'][0]
  token: string
  onMatchDone: (matchId: string, clientId: string) => void
}) {
  const [open, setOpen] = useState(true)

  const handleDone = (matchId: string) => {
    onMatchDone(matchId, applicant.client_id)
  }

  const activeMatches = applicant.matches.filter((m) => m.vacancy.is_open)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: '#005eb8' }}
          >
            {applicant.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">{applicant.full_name}</p>
            <p className="text-xs text-gray-500 font-mono">{applicant.client_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: activeMatches.length > 0 ? '#d5281b' : '#768692' }}
          >
            {activeMatches.length} {activeMatches.length === 1 ? 'vacancy' : 'vacancies'}
          </span>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && activeMatches.length > 0 && (
        <div className="px-5 pb-2 border-t border-gray-100">
          {activeMatches.map((m) => (
            <VacancyCard
              key={m.match_id}
              matchId={m.match_id}
              vacancy={m.vacancy}
              token={token}
              onDone={handleDone}
            />
          ))}
        </div>
      )}

      {open && activeMatches.length === 0 && (
        <div className="px-5 py-3 border-t border-gray-100 text-sm text-gray-500 italic">
          All vacancies have been processed or closed.
        </div>
      )}
    </div>
  )
}

export default function VacanciesDashboard() {
  const { token } = useAdminToken()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [checking, setChecking] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)

  const fetchDashboard = useCallback(async (t: string) => {
    const res = await fetch('/api/vacancies/dashboard', {
      headers: { 'x-admin-token': t },
    })
    if (res.ok) {
      const d = await res.json()
      setData(d)
    }
    setLoading(false)
  }, [])

  // On load: fetch dashboard + recheck open vacancies
  useEffect(() => {
    if (!token) return
    setChecking(true)
    Promise.all([
      fetchDashboard(token),
      fetch('/api/vacancies/check', {
        method: 'POST',
        headers: { 'x-admin-token': token },
      }),
    ]).then(() => {
      setChecking(false)
      // Re-fetch after recheck to pick up newly closed vacancies
      fetchDashboard(token)
    })
  }, [token, fetchDashboard])

  const handleScan = async () => {
    setScanning(true)
    setScanMsg(null)
    const res = await fetch('/api/vacancies/scan', {
      method: 'POST',
      headers: { 'x-admin-token': token },
    })
    const result = await res.json()
    setScanning(false)
    if (res.ok) {
      setScanMsg(
        result.new_matches > 0
          ? `Scan complete. ${result.new_matches} new match${result.new_matches === 1 ? '' : 'es'} found across ${result.new_vacancies} vacancies.`
          : 'Scan complete. No new matches found.'
      )
      await fetchDashboard(token)
    } else {
      setScanMsg('Scan failed. Please try again.')
    }
  }

  const handleMatchDone = (matchId: string, clientId: string) => {
    setData((prev) => {
      if (!prev) return prev
      const updated = prev.needs_action.map((a) => {
        if (a.client_id !== clientId) return a
        return { ...a, matches: a.matches.filter((m) => m.match_id !== matchId) }
      })
      // Move clients with 0 pending to all_clear
      const stillNeeds = updated.filter((a) => a.matches.some((m) => m.vacancy.is_open))
      const nowClear = updated
        .filter((a) => !a.matches.some((m) => m.vacancy.is_open))
        .map((a) => ({ client_id: a.client_id, client_code: a.client_code, full_name: a.full_name }))

      return {
        ...prev,
        needs_action: stillNeeds,
        all_clear: [...prev.all_clear, ...nowClear],
      }
    })
  }

  const formatLastScan = (iso: string | null) => {
    if (!iso) return 'Never scanned'
    const d = new Date(iso)
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.round(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin} min ago`
    const diffHours = Math.floor(diffMin / 60)
    return `${diffHours}h ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#005eb8' }} />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  const needsAction = data?.needs_action || []
  const allClear = data?.all_clear || []
  const totalApplicants = needsAction.length + allClear.length

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-6">
        {/* Status bar */}
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-500">Last scan</p>
              <p className="text-sm font-semibold text-gray-900">{formatLastScan(data?.last_scan_at || null)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Open vacancies</p>
              <p className="text-sm font-semibold text-gray-900">{data?.total_open_vacancies || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Applicants monitored</p>
              <p className="text-sm font-semibold text-gray-900">{totalApplicants}</p>
            </div>
            {checking && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                Rechecking open vacancies...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {scanMsg && (
              <span className="text-xs text-gray-600">{scanMsg}</span>
            )}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-4 py-2 text-sm font-semibold text-white rounded-md cursor-pointer disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: '#005eb8' }}
            >
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </span>
              ) : 'Scan Now'}
            </button>
          </div>
        </div>

        {/* Needs Action */}
        {needsAction.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: '#d5281b' }}
              >
                {needsAction.length}
              </span>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Needs Action
              </h2>
              <span className="text-xs text-gray-400">— applicants with open vacancies</span>
            </div>
            <div className="space-y-3">
              {needsAction.map((applicant) => (
                <ApplicantCard
                  key={applicant.client_id}
                  applicant={applicant}
                  token={token}
                  onMatchDone={handleMatchDone}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Clear */}
        {allClear.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: '#009639' }}
              >
                {allClear.length}
              </span>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">All Clear</h2>
              <span className="text-xs text-gray-400">— no new vacancies in last 48 hours</span>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {allClear.map((c, i) => (
                <div
                  key={c.client_id}
                  className={`flex items-center gap-3 px-5 py-3 ${i < allClear.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: '#768692' }}
                  >
                    {c.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700">{c.full_name}</span>
                  <span className="text-xs text-gray-400 font-mono ml-auto">{c.client_code}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {needsAction.length === 0 && allClear.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-3">No applicant preferences set up yet.</p>
            <Link
              href="/admin/vacancies/preferences"
              className="inline-block px-4 py-2 text-sm font-semibold text-white rounded-md"
              style={{ backgroundColor: '#005eb8' }}
            >
              Set Up Applicant Preferences
            </Link>
          </div>
        )}
    </div>
  )
}
