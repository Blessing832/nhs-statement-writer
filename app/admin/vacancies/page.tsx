'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { useAdminToken } from '@/lib/admin-context'
import type { ApplicantPreferences, SearchLink } from '@/lib/vacancy/types'
import type { Client } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Vacancy {
  id: number
  reference: string
  title: string
  companyName: string
  location: string
  salary: string
  closingDate: string
  url: string
  staffGroup: 'nursing' | 'allied'
  datePosted: string
  createdAt: string
}

// ── Source colours (applicant links) ─────────────────────────────────────────
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

// ── Vacancy card helpers ──────────────────────────────────────────────────────
function closingStatus(closingDate: string): { label: string; urgent: boolean } {
  if (!closingDate) return { label: '', urgent: false }
  const closing = new Date(closingDate)
  const now = new Date()
  const diffDays = Math.ceil((closing.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0)  return { label: 'Closed', urgent: true }
  if (diffDays === 0) return { label: 'Closes today', urgent: true }
  if (diffDays <= 3)  return { label: `Closes in ${diffDays} day${diffDays === 1 ? '' : 's'}`, urgent: true }
  return { label: `Closes ${closing.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, urgent: false }
}

// ── Vacancy card ──────────────────────────────────────────────────────────────
function VacancyCard({ v }: { v: Vacancy }) {
  const cs = closingStatus(v.closingDate)
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 text-sm leading-snug">{v.title}</p>
        {cs.label && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cs.urgent ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
            {cs.label}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-600 font-medium">{v.companyName}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        {v.location && <span>📍 {v.location}</span>}
        {v.salary   && <span>💷 {v.salary}</span>}
      </div>
      <a
        href={v.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg self-start hover:opacity-90 active:scale-95 transition-all"
        style={{ backgroundColor: '#0B4F6C' }}
      >
        Apply Now ↗
      </a>
    </div>
  )
}

// ── Vacancy column ────────────────────────────────────────────────────────────
function VacancyColumn({
  title, vacancies, loading, color,
}: {
  title: string
  vacancies: Vacancy[]
  loading: boolean
  color: string
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
        {!loading && (
          <span className="text-xs text-gray-400 ml-auto">
            {vacancies.length} {vacancies.length === 1 ? 'vacancy' : 'vacancies'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: color }} />
          <span className="text-sm">Loading…</span>
        </div>
      ) : vacancies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          No vacancies yet today.
          <br />
          <span className="text-xs">Next check: 10:30am, 12pm, 2pm, 4pm (Mon–Fri)</span>
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map(v => <VacancyCard key={v.id} v={v} />)}
        </div>
      )}
    </div>
  )
}

// ── Live vacancies tab ────────────────────────────────────────────────────────
function LiveVacanciesTab({ token }: { token: string }) {
  const [nursing, setNursing]   = useState<Vacancy[]>([])
  const [allied,  setAllied]    = useState<Vacancy[]>([])
  const [loading, setLoading]   = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchVacancies = useCallback(async () => {
    setLoading(true)
    const [nRes, aRes] = await Promise.all([
      fetch('/api/vacancies/nursing'),
      fetch('/api/vacancies/allied'),
    ])
    if (nRes.ok) setNursing(await nRes.json())
    if (aRes.ok) setAllied(await aRes.json())
    setLoading(false)
    setLastFetch(new Date())
  }, [])

  useEffect(() => {
    fetchVacancies()
    timerRef.current = setInterval(fetchVacancies, 30 * 60 * 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchVacancies])

  async function handleTrigger() {
    setTriggering(true)
    setTriggerMsg('')
    try {
      const res = await fetch('/api/vacancies/trigger', {
        method: 'POST',
        headers: { 'x-admin-token': token },
      })
      const data = await res.json() as { runId?: string; error?: string }
      if (data.runId) {
        setTriggerMsg(`Scraper started (run ${data.runId}). Results will arrive in ~2-5 min via webhook.`)
      } else {
        setTriggerMsg(data.error ?? 'Unknown error')
      }
    } catch {
      setTriggerMsg('Request failed')
    }
    setTriggering(false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="text-xs text-gray-400">
          {lastFetch
            ? `Last updated ${lastFetch.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · auto-refreshes every 30 min`
            : 'Loading…'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchVacancies}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            ↻ Refresh
          </button>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="text-xs px-3 py-1.5 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: '#F4A800' }}
          >
            {triggering ? 'Starting…' : '▶ Run Scraper Now'}
          </button>
        </div>
      </div>

      {triggerMsg && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
          {triggerMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <VacancyColumn title="Nursing & Midwifery" vacancies={nursing} loading={loading} color="#0B4F6C" />
        <div className="hidden md:block w-px bg-gray-100" />
        <VacancyColumn title="Allied Health Professionals" vacancies={allied} loading={loading} color="#F4A800" />
      </div>
    </div>
  )
}

// ── Applicant links tab ───────────────────────────────────────────────────────
const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32 } },
}

function ApplicantCard({ client, pref }: { client: Client; pref: ApplicantPreferences | null }) {
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
              <Link href="/admin/vacancies/preferences" className="text-xs text-blue-600 hover:underline shrink-0 ml-4">Set up links →</Link>
            </div>
          ) : links.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400 italic">Applicant added but no links yet.</p>
              <Link href="/admin/vacancies/preferences" className="text-xs text-blue-600 hover:underline shrink-0 ml-4">Add links →</Link>
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
              <Link href="/admin/vacancies/preferences" className="text-xs text-blue-600 hover:underline">Edit links →</Link>
              {pref.notes && <p className="text-xs text-gray-400 italic">{pref.notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ApplicantLinksTab({ token }: { token: string }) {
  const [clients, setClients] = useState<Client[]>([])
  const [prefs,   setPrefs]   = useState<ApplicantPreferences[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch('/api/clients', { headers: { 'x-admin-token': token } }),
      fetch('/api/vacancies/preferences', { headers: { 'x-admin-token': token } }),
    ])
    if (cRes.ok) setClients(await cRes.json())
    if (pRes.ok) setPrefs(await pRes.json())
    setLoading(false)
  }, [token])

  useEffect(() => { if (token) fetchData() }, [token, fetchData])

  const prefMap  = new Map(prefs.map(p => [p.client_id, p]))
  const active   = clients.filter(c => c.is_active && new Date() <= new Date(c.subscription_end))
  const inactive = clients.filter(c => !c.is_active || new Date() > new Date(c.subscription_end))
  const withLinks = active.filter(c => (prefMap.get(c.id)?.search_links ?? []).length > 0)
  const noLinks   = active.filter(c => (prefMap.get(c.id)?.search_links ?? []).length === 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#0B4F6C' }} />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          {withLinks.length} of {active.length} active candidates have links
          {noLinks.length > 0 && <span className="text-yellow-600"> · {noLinks.length} still need setting up</span>}
        </p>
        <Link href="/admin/vacancies/preferences" className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm cursor-pointer" style={{ backgroundColor: '#0B4F6C' }}>+ Manage Links</Link>
      </div>

      <div className="mb-5 rounded-xl bg-blue-50 border border-blue-100 px-5 py-4 flex gap-3 items-start">
        <span className="text-blue-500 text-lg shrink-0">💡</span>
        <p className="text-sm text-blue-800 leading-relaxed"><strong>How to use:</strong> Click a candidate to expand their links. Click a link to open the pre-filtered job board, find a vacancy, then generate their statement.</p>
      </div>

      {withLinks.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Ready: {withLinks.length} candidate{withLinks.length !== 1 ? 's' : ''}</p>
          <motion.div className="space-y-3" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
            {withLinks.map(client => (<motion.div key={client.id} variants={cardVariants}><ApplicantCard client={client} pref={prefMap.get(client.id) ?? null} /></motion.div>))}
          </motion.div>
        </section>
      )}

      {noLinks.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-3">Needs Links: {noLinks.length} candidate{noLinks.length !== 1 ? 's' : ''}</p>
          <motion.div className="space-y-3" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
            {noLinks.map(client => (<motion.div key={client.id} variants={cardVariants}><ApplicantCard client={client} pref={prefMap.get(client.id) ?? null} /></motion.div>))}
          </motion.div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Expired / Inactive: {inactive.length}</p>
          <div className="space-y-2 opacity-50">
            {inactive.map(client => (
              <div key={client.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{(client.full_name ?? '?').charAt(0).toUpperCase()}</div>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VacanciesDashboard() {
  const { token } = useAdminToken()
  const [tab, setTab] = useState<'live' | 'links'>('live')

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">Vacancies</h2>
        <p className="text-sm text-gray-500 mt-0.5">Live NHS board + applicant search links</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(['live', 'links'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'live' ? '📋 Live Vacancies Today' : '🔗 Applicant Links'}
          </button>
        ))}
      </div>

      {tab === 'live'  && <LiveVacanciesTab  token={token} />}
      {tab === 'links' && <ApplicantLinksTab token={token} />}
    </div>
  )
}
