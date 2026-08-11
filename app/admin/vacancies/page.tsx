'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { useAdminToken } from '@/lib/admin-context'
import type { ApplicantPreferences, SearchLink } from '@/lib/vacancy/types'
import type { Client } from '@/lib/types'

// ── types ─────────────────────────────────────────────────────────────────────

interface LiveVacancy {
  id: string
  external_id: string
  title: string
  employer: string
  location: string
  band: string
  contract_type: string
  closing_date: string
  url: string
  scraped_at: string
}

interface TrackingEntry {
  client_code: string
  vacancy_id: string
  vacancy_title: string
  status: 'done' | 'closed'
  marked_at: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  nhsjobs:      '#0B4F6C',
  healthjobsuk: '#009639',
  scotland:     '#072f42',
  civilservice: '#4c2c92',
  other:        '#555',
}

function guessSource(url: string): string {
  if (url.includes('jobs.nhs.uk'))      return 'nhsjobs'
  if (url.includes('healthjobsuk.com')) return 'healthjobsuk'
  if (url.includes('jobs.scot.nhs.uk')) return 'scotland'
  if (url.includes('civilservicejobs')) return 'civilservice'
  return 'other'
}

function sourceLabel(url: string): string {
  return ({
    nhsjobs:      'NHS Jobs',
    healthjobsuk: 'HealthJobsUK',
    scotland:     'NHS Scotland',
    civilservice: 'Civil Service',
    other:        'Job Board',
  })[guessSource(url)] ?? 'Job Board'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h === 0) return `${m}m ago`
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function isNew(scrapedAt: string): boolean {
  return Date.now() - new Date(scrapedAt).getTime() < 2 * 60 * 60 * 1000
}

// ── Tab 2 components ──────────────────────────────────────────────────────────

function ApplicantCard({ client, pref, doneCount, closedCount }: { client: Client; pref: ApplicantPreferences | null; doneCount: number; closedCount: number }) {
  const [open, setOpen] = useState(false)
  const links: SearchLink[] = pref?.search_links ?? []
  const hasLinks = links.length > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: pref ? '#0B4F6C' : '#9ca3af' }}
          >
            {(client.full_name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">{client.full_name}</p>
            <p className="text-xs text-gray-400 font-mono">{client.client_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doneCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">
              {doneCount} applied
            </span>
          )}
          {closedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">
              {closedCount} closed
            </span>
          )}
          {pref ? (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasLinks ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
              {hasLinks ? `${links.length} ${links.length === 1 ? 'link' : 'links'}` : 'No links yet'}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              Not set up
            </span>
          )}
          <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {!pref ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400 italic">No search links set up for this applicant yet.</p>
              <Link href="/admin/vacancies/preferences" className="text-xs text-blue-600 hover:underline shrink-0 ml-4">
                Set up links →
              </Link>
            </div>
          ) : links.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400 italic">Applicant added but no links yet.</p>
              <Link href="/admin/vacancies/preferences" className="text-xs text-blue-600 hover:underline shrink-0 ml-4">
                Add links →
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {links.map(link => {
                const src = guessSource(link.url)
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
                    style={{ backgroundColor: SOURCE_COLORS[src] }}
                  >
                    <span className="text-xs opacity-75">{sourceLabel(link.url)}</span>
                    <span>·</span>
                    <span>{link.label}</span>
                    <span className="ml-0.5 opacity-70">↗</span>
                  </a>
                )
              })}
            </div>
          )}
          {pref && (
            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
              <Link href="/admin/vacancies/preferences" className="text-xs text-blue-600 hover:underline">
                Edit links →
              </Link>
              {pref.notes && <p className="text-xs text-gray-400 italic">{pref.notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab 1 component ───────────────────────────────────────────────────────────

function VacancyRow({ v }: { v: LiveVacancy }) {
  return (
    <a
      href={v.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-2">
          {isNew(v.scraped_at) && (
            <span className="shrink-0 mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-green-500 text-white leading-none">NEW</span>
          )}
          <div>
            <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors truncate">
              {v.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{v.employer || 'NHS'}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{timeAgo(v.scraped_at)}</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {v.location && (
          <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
            📍 {v.location}
          </span>
        )}
        {v.band && (
          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-100">
            💰 {v.band}
          </span>
        )}
        {v.contract_type && (
          <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-md border border-purple-100">
            {v.contract_type}
          </span>
        )}
        {v.closing_date && (
          <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-md border border-orange-100">
            Closes {v.closing_date}
          </span>
        )}
      </div>
    </a>
  )
}

function LiveVacanciesTab({ token }: { token: string }) {
  const [vacancies, setVacancies] = useState<LiveVacancy[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [search, setSearch] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const loadVacancies = useCallback(async () => {
    const res = await fetch('/api/vacancies/live', { headers: { 'x-admin-token': token } })
    if (res.ok) {
      setVacancies(await res.json())
      setLastRefresh(new Date())
    }
    setLoading(false)
  }, [token])

  useEffect(() => { if (token) loadVacancies() }, [token, loadVacancies])

  const triggerScrape = async () => {
    setScraping(true)
    try {
      const res = await fetch('/api/vacancies/trigger', {
        method: 'POST',
        headers: { 'x-admin-token': token },
      })
      if (res.ok) {
        alert('Scrape started! Results will appear here within a few minutes once the Apify actor completes.')
      } else {
        const j = await res.json()
        alert(`Failed: ${j.error ?? 'Unknown error'}`)
      }
    } finally {
      setScraping(false)
    }
  }

  const filtered = vacancies.filter(v => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      v.title.toLowerCase().includes(q) ||
      (v.employer ?? '').toLowerCase().includes(q) ||
      (v.location ?? '').toLowerCase().includes(q) ||
      (v.band ?? '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-6 h-6 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#0B4F6C' }} />
        <p className="text-sm text-gray-400">Loading vacancies…</p>
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search title, employer, location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          />
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <p className="text-xs text-gray-400">Updated {timeAgo(lastRefresh.toISOString())}</p>
          )}
          <button
            onClick={loadVacancies}
            className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={triggerScrape}
            disabled={scraping}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm disabled:opacity-60 transition-colors"
            style={{ backgroundColor: '#0B4F6C' }}
          >
            {scraping ? 'Triggering…' : 'Scrape Now'}
          </button>
        </div>
      </div>

      {/* Count */}
      {vacancies.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          {filtered.length} of {vacancies.length} vacanc{vacancies.length === 1 ? 'y' : 'ies'}
          {search ? ` matching "${search}"` : ''}
        </p>
      )}

      {/* Results */}
      {vacancies.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-3xl mb-3">🏥</p>
          <p className="text-gray-700 font-semibold mb-1">No vacancies yet</p>
          <p className="text-sm text-gray-400 mb-5">
            Hit <strong>Scrape Now</strong> to trigger the first Apify run.
            Results appear automatically once the scraper completes.
          </p>
          <p className="text-xs text-gray-400">
            Automatic scrapes run at 10:30am, 12:30pm, 2:30pm and 4pm (London time).
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No vacancies match your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(v => <VacancyRow key={v.id} v={v} />)}
        </div>
      )}
    </div>
  )
}

// ── Tab 2 component ───────────────────────────────────────────────────────────

const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32 } },
}

function ApplicantLinksTab({ token }: { token: string }) {
  const [clients, setClients] = useState<Client[]>([])
  const [prefs, setPrefs]   = useState<ApplicantPreferences[]>([])
  const [tracking, setTracking] = useState<TrackingEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [cRes, pRes, tRes] = await Promise.all([
      fetch('/api/clients', { headers: { 'x-admin-token': token } }),
      fetch('/api/vacancies/preferences', { headers: { 'x-admin-token': token } }),
      fetch('/api/vacancies/track?all=1', { headers: { 'x-admin-token': token } }),
    ])
    if (cRes.ok) setClients(await cRes.json())
    if (pRes.ok) setPrefs(await pRes.json())
    if (tRes.ok) setTracking(await tRes.json())
    setLoading(false)
  }, [token])

  useEffect(() => { if (token) fetchData() }, [token, fetchData])

  const prefMap = new Map(prefs.map(p => [p.client_id, p]))

  const trackingByCode = new Map<string, { done: number; closed: number }>()
  for (const entry of tracking) {
    const curr = trackingByCode.get(entry.client_code) ?? { done: 0, closed: 0 }
    if (entry.status === 'done')   curr.done++
    if (entry.status === 'closed') curr.closed++
    trackingByCode.set(entry.client_code, curr)
  }
  const totalApplied = tracking.filter(e => e.status === 'done').length
  const active   = clients.filter(c => c.is_active && new Date() <= new Date(c.subscription_end))
  const inactive = clients.filter(c => !c.is_active || new Date() > new Date(c.subscription_end))
  const withLinks = active.filter(c => (prefMap.get(c.id)?.search_links ?? []).length > 0)
  const noLinks   = active.filter(c => (prefMap.get(c.id)?.search_links ?? []).length === 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-6 h-6 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#0B4F6C' }} />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">
            {withLinks.length} of {active.length} active candidates have links
            {noLinks.length > 0 && <span className="text-yellow-600"> · {noLinks.length} still need setting up</span>}
          </p>
          {totalApplied > 0 && (
            <p className="text-sm text-green-700 font-semibold mt-0.5">
              {totalApplied} application{totalApplied !== 1 ? 's' : ''} logged today across all candidates
            </p>
          )}
        </div>
        <Link
          href="/admin/vacancies/preferences"
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm cursor-pointer"
          style={{ backgroundColor: '#0B4F6C' }}
        >
          + Manage Links
        </Link>
      </div>

      {/* Tip */}
      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-100 px-5 py-4 flex gap-3 items-start">
        <span className="text-blue-500 text-lg shrink-0">💡</span>
        <div className="text-sm text-blue-800 leading-relaxed">
          <strong>How to use:</strong> Click a candidate to expand their links. Click a link to open the pre-filtered job board, find a vacancy, then generate their statement.
        </div>
      </div>

      {withLinks.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Ready: {withLinks.length} candidate{withLinks.length !== 1 ? 's' : ''}
          </p>
          <motion.div className="space-y-3" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
            {withLinks.map(client => (
              <motion.div key={client.id} variants={cardVariants}>
                <ApplicantCard client={client} pref={prefMap.get(client.id) ?? null} doneCount={trackingByCode.get(client.client_code)?.done ?? 0} closedCount={trackingByCode.get(client.client_code)?.closed ?? 0} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {noLinks.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-3">
            Needs Links: {noLinks.length} candidate{noLinks.length !== 1 ? 's' : ''}
          </p>
          <motion.div className="space-y-3" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
            {noLinks.map(client => (
              <motion.div key={client.id} variants={cardVariants}>
                <ApplicantCard client={client} pref={prefMap.get(client.id) ?? null} doneCount={trackingByCode.get(client.client_code)?.done ?? 0} closedCount={trackingByCode.get(client.client_code)?.closed ?? 0} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Expired / Inactive: {inactive.length}
          </p>
          <div className="space-y-2 opacity-50">
            {inactive.map(client => (
              <div key={client.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                  {(client.full_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-600">{client.full_name}</span>
                <span className="text-xs text-gray-400 font-mono ml-auto">{client.client_code}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'live' | 'links'

export default function VacanciesDashboard() {
  const { token } = useAdminToken()
  const [activeTab, setActiveTab] = useState<Tab>('live')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'live',  label: 'Live Vacancies Today' },
    { id: 'links', label: 'Applicant Links' },
  ]

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8">
      {/* Page title */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">Vacancies</h2>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'live'  && <LiveVacanciesTab token={token} />}
      {activeTab === 'links' && <ApplicantLinksTab token={token} />}
    </div>
  )
}
