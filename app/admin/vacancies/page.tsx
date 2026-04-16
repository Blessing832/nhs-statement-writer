'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { useAdminToken } from '@/lib/admin-context'
import type { ApplicantPreferences, SearchLink } from '@/lib/vacancy/types'

const SOURCE_COLORS: Record<string, string> = {
  nhsjobs:      '#005eb8',
  healthjobsuk: '#009639',
  scotland:     '#003087',
  civilservice: '#4c2c92',
  other:        '#555',
}

function guessSource(url: string): string {
  if (url.includes('jobs.nhs.uk'))            return 'nhsjobs'
  if (url.includes('healthjobsuk.com'))        return 'healthjobsuk'
  if (url.includes('jobs.scot.nhs.uk'))        return 'scotland'
  if (url.includes('civilservicejobs'))        return 'civilservice'
  return 'other'
}

function sourceLabel(url: string): string {
  const s = guessSource(url)
  return {
    nhsjobs:      'NHS Jobs',
    healthjobsuk: 'HealthJobsUK',
    scotland:     'NHS Scotland',
    civilservice: 'Civil Service',
    other:        'Job Board',
  }[s] ?? 'Job Board'
}

function ApplicantCard({ pref }: { pref: ApplicantPreferences }) {
  const [open, setOpen] = useState(true)
  const links: SearchLink[] = pref.search_links ?? []
  const client = pref.client

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: '#005eb8' }}
          >
            {(client?.full_name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">{client?.full_name ?? '—'}</p>
            <p className="text-xs text-gray-400 font-mono">{client?.client_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
            {links.length} {links.length === 1 ? 'link' : 'links'}
          </span>
          <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {links.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No search links yet. Edit preferences to add some.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {links.map(link => {
                const src = guessSource(link.url)
                const color = SOURCE_COLORS[src]
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
                    style={{ backgroundColor: color }}
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
          <div className="mt-3 pt-3 border-t border-gray-50">
            <Link
              href={`/admin/vacancies/preferences`}
              className="text-xs text-blue-600 hover:underline"
            >
              Edit links →
            </Link>
            {pref.notes && (
              <p className="text-xs text-gray-400 mt-1 italic">{pref.notes}</p>
            )}
          </div>
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
  const [prefs, setPrefs] = useState<ApplicantPreferences[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPrefs = useCallback(async () => {
    const res = await fetch('/api/vacancies/preferences', {
      headers: { 'x-admin-token': token },
    })
    if (res.ok) setPrefs(await res.json())
    setLoading(false)
  }, [token])

  useEffect(() => { if (token) fetchPrefs() }, [token, fetchPrefs])

  const active = prefs.filter(p => p.is_active)
  const inactive = prefs.filter(p => !p.is_active)

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
            Click a link to open the pre-filtered job search for that applicant in a new tab.
          </p>
        </div>
        <Link
          href="/admin/vacancies/preferences"
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm cursor-pointer"
          style={{ backgroundColor: '#005eb8' }}
        >
          + Manage Applicants
        </Link>
      </div>

      {/* How it works callout */}
      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-100 px-5 py-4 flex gap-3 items-start">
        <span className="text-blue-500 text-lg shrink-0">💡</span>
        <div className="text-sm text-blue-800 leading-relaxed">
          <strong>How to use:</strong> Each applicant has one or more pre-filtered job search links.
          Click a link to open the job board showing only the vacancies matching their preferences.
          Browse, find a suitable job, copy the URL and generate their statement.
        </div>
      </div>

      {/* Active applicants */}
      {active.length > 0 ? (
        <section className="mb-8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Active — {active.length} applicant{active.length !== 1 ? 's' : ''}
          </p>
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          >
            {active.map(pref => (
              <motion.div key={pref.id} variants={cardVariants}>
                <ApplicantCard pref={pref} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400 mb-4 text-sm">No applicants set up yet.</p>
          <Link
            href="/admin/vacancies/preferences"
            className="inline-block px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ backgroundColor: '#005eb8' }}
          >
            Add First Applicant
          </Link>
        </div>
      )}

      {/* Paused applicants */}
      {inactive.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Paused — {inactive.length}
          </p>
          <div className="space-y-2 opacity-60">
            {inactive.map(pref => (
              <div key={pref.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                  {(pref.client?.full_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-600">{pref.client?.full_name}</span>
                <span className="text-xs text-gray-400 font-mono ml-auto">{pref.client?.client_code}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
