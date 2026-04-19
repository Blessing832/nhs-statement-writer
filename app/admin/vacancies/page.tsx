'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { useAdminToken } from '@/lib/admin-context'
import type { ApplicantPreferences, SearchLink } from '@/lib/vacancy/types'
import type { Client } from '@/lib/types'

const SOURCE_COLORS: Record<string, string> = {
  nhsjobs:      '#005eb8',
  healthjobsuk: '#009639',
  scotland:     '#003087',
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
            style={{ backgroundColor: pref ? '#005eb8' : '#9ca3af' }}
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
              <Link
                href="/admin/vacancies/preferences"
                className="text-xs text-blue-600 hover:underline shrink-0 ml-4"
              >
                Set up links →
              </Link>
            </div>
          ) : links.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400 italic">Applicant added but no links yet.</p>
              <Link
                href="/admin/vacancies/preferences"
                className="text-xs text-blue-600 hover:underline shrink-0 ml-4"
              >
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

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32 } },
}

export default function VacanciesDashboard() {
  const { token } = useAdminToken()
  const [clients, setClients] = useState<Client[]>([])
  const [prefs, setPrefs] = useState<ApplicantPreferences[]>([])
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

  const prefMap = new Map(prefs.map(p => [p.client_id, p]))

  const active   = clients.filter(c => c.is_active && new Date() <= new Date(c.subscription_end))
  const inactive = clients.filter(c => !c.is_active || new Date() > new Date(c.subscription_end))

  const withLinks = active.filter(c => (prefMap.get(c.id)?.search_links ?? []).length > 0)
  const noLinks   = active.filter(c => (prefMap.get(c.id)?.search_links ?? []).length === 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-6 h-6 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#005eb8' }} />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Vacancy Search Links</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {withLinks.length} of {active.length} active candidates have links
            {noLinks.length > 0 && <span className="text-yellow-600"> · {noLinks.length} still need setting up</span>}
          </p>
        </div>
        <Link
          href="/admin/vacancies/preferences"
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm cursor-pointer"
          style={{ backgroundColor: '#005eb8' }}
        >
          + Manage Links
        </Link>
      </div>

      {/* Tip */}
      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-100 px-5 py-4 flex gap-3 items-start">
        <span className="text-blue-500 text-lg shrink-0">💡</span>
        <div className="text-sm text-blue-800 leading-relaxed">
          <strong>How to use:</strong> Click a candidate to expand their links. Click a link to open
          the pre-filtered job board, find a vacancy, then generate their statement.
        </div>
      </div>

      {/* Candidates with links */}
      {withLinks.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Ready: {withLinks.length} candidate{withLinks.length !== 1 ? 's' : ''}
          </p>
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {withLinks.map(client => (
              <motion.div key={client.id} variants={cardVariants}>
                <ApplicantCard client={client} pref={prefMap.get(client.id) ?? null} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* Candidates without links */}
      {noLinks.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-3">
            Needs Links: {noLinks.length} candidate{noLinks.length !== 1 ? 's' : ''}
          </p>
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {noLinks.map(client => (
              <motion.div key={client.id} variants={cardVariants}>
                <ApplicantCard client={client} pref={prefMap.get(client.id) ?? null} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* Inactive / expired */}
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
