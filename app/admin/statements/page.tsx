'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAdminToken } from '@/lib/admin-context'

interface StatementRow {
  id: string
  job_title: string
  organisation: string
  vacancy_url: string
  created_at: string
  is_rewrite: boolean
  spec_pasted: boolean | null
  spec_word_count: number
  client: { id: string; client_code: string; full_name: string } | null
}

interface StatementDetail extends StatementRow {
  generated_statement: string
  key_duties: string[]
  rewrite_instruction: string | null
  pasted_person_spec: string | null
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

function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

function StatementContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const t = raw.trim()

    if (!t) {
      nodes.push(<div key={i} className="h-3" />)
      continue
    }

    // Whole-line bold = subheading (Style 1 subheadings)
    if (/^\*\*[^*]+\*\*$/.test(t)) {
      nodes.push(
        <p key={i} className="font-semibold text-sm mt-5 mb-1" style={{ color: '#072f42' }}>
          {t.replace(/\*\*/g, '')}
        </p>
      )
      continue
    }

    // Question labels for Scotland (Q1 / Question 1)
    if (/^(Question\s+\d+|Q\d+)\s*:/i.test(t)) {
      nodes.push(
        <p key={i} className="font-bold text-sm mt-6 mb-2 uppercase tracking-wide" style={{ color: '#0B4F6C' }}>
          {t}
        </p>
      )
      continue
    }

    nodes.push(
      <p key={i} className="text-sm text-gray-800 leading-relaxed">
        {parseBold(t)}
      </p>
    )
  }

  return <div className="space-y-1">{nodes}</div>
}

function downloadAsWord(content: string, clientName: string, jobTitle: string) {
  const lines = content.split('\n')
  let html = ''
  for (const line of lines) {
    const t = line.trim()
    if (!t) { html += '<p>&nbsp;</p>'; continue }
    if (/^\*\*[^*]+\*\*$/.test(t)) {
      html += `<h2 style="color:#003087;font-size:12pt;margin-top:14pt;">${t.replace(/\*\*/g, '')}</h2>`
      continue
    }
    if (/^(Question\s+\d+|Q\d+)\s*:/i.test(t)) {
      html += `<h2 style="color:#005eb8;font-size:12pt;margin-top:16pt;">${t}</h2>`
      continue
    }
    const text = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html += `<p style="margin-bottom:6pt;">${text}</p>`
  }

  const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${jobTitle} - ${clientName}</title>
<style>body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.6;margin:2cm;color:#111;}h1{font-size:16pt;color:#003087;}h2{font-size:12pt;}p{margin:0 0 6pt 0;}</style>
</head><body>
<h1 style="color:#003087;border-bottom:2px solid #003087;padding-bottom:6pt;">${jobTitle}${jobTitle && ' — '}${clientName}</h1>
${html}
</body></html>`

  const blob = new Blob(['﻿', fullHtml], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${clientName.replace(/\s+/g, '-').toLowerCase()}-statement.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function StatementsPage() {
  const { token } = useAdminToken()
  const [statements, setStatements] = useState<StatementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<StatementDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [specFilter, setSpecFilter] = useState<'all' | 'pasted' | 'missing'>('all')
  const [showFullSpec, setShowFullSpec] = useState(false)

  const fetchStatements = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/statements?limit=200', {
      headers: { 'x-admin-token': token },
    })
    if (res.ok) setStatements(await res.json())
    setLoading(false)
  }, [token])

  useEffect(() => { fetchStatements() }, [fetchStatements])

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    setShowFullSpec(false)
    const res = await fetch(`/api/admin/statements/${id}`, {
      headers: { 'x-admin-token': token },
    })
    if (res.ok) setDetail(await res.json())
    setDetailLoading(false)
  }, [token])

  const closeDetail = () => {
    setSelectedId(null)
    setDetail(null)
  }

  const filtered = statements.filter((s) => {
    const q = search.toLowerCase()
    const matchesSearch =
      s.job_title?.toLowerCase().includes(q) ||
      s.organisation?.toLowerCase().includes(q) ||
      s.client?.full_name?.toLowerCase().includes(q) ||
      s.client?.client_code?.toLowerCase().includes(q)
    const matchesSpec =
      specFilter === 'all' ||
      (specFilter === 'pasted' && s.spec_pasted === true) ||
      (specFilter === 'missing' && s.spec_pasted === false)
    return matchesSearch && matchesSpec
  })

  const grouped = filtered.reduce<Record<string, StatementRow[]>>((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(s)
    return acc
  }, {})

  const today = new Date().toDateString()
  const thisWeek = statements.filter(
    (s) => Date.now() - new Date(s.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
  ).length

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Statements</p>
          <p className="text-3xl font-bold" style={{ color: '#072f42' }}>{statements.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">This Week</p>
          <p className="text-3xl font-bold" style={{ color: '#0B4F6C' }}>{thisWeek}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Today</p>
          <p className="text-3xl font-bold" style={{ color: '#009639' }}>
            {statements.filter((s) => new Date(s.created_at).toDateString() === today).length}
          </p>
        </div>
      </div>

      {/* Spec compliance summary */}
      {statements.length > 0 && (() => {
        const known = statements.filter(s => s.spec_pasted !== null)
        const pasted = statements.filter(s => s.spec_pasted === true).length
        const missing = statements.filter(s => s.spec_pasted === false).length
        const pct = known.length > 0 ? Math.round((pasted / known.length) * 100) : 0
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-5 flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Person spec compliance</p>
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-gray-100 w-40 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: pct === 100 ? '#009639' : pct >= 50 ? '#0B4F6C' : '#d4351c' }}>
                  {known.length > 0 ? `${pct}%` : '—'}
                </span>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-700 font-medium">{pasted} with spec</span>
              <span className="text-gray-300">|</span>
              {missing > 0
                ? <span className="text-red-600 font-medium">{missing} missing</span>
                : <span className="text-gray-400">{missing} missing</span>}
            </div>
          </div>
        )
      })()}

      {/* Search + filter */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by candidate, job title, or organisation…"
          className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
        />
        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
          {(['all', 'pasted', 'missing'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSpecFilter(f)}
              className={`px-3 py-1.5 text-xs rounded font-medium transition-colors cursor-pointer
                ${specFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f === 'all' ? 'All' : f === 'pasted' ? '✓ Spec pasted' : '✗ No spec'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{filtered.length} of {statements.length}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#0B4F6C' }} />
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
                  <button
                    key={s.id}
                    onClick={() => openDetail(s.id)}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors
                      ${i < rows.length - 1 ? 'border-b border-gray-100' : ''}
                      ${selectedId === s.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: '#0B4F6C' }}
                    >
                      {s.client?.full_name?.charAt(0).toUpperCase() || '?'}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {s.job_title || 'Untitled Role'}
                        </span>
                        {s.organisation && (
                          <span className="text-xs text-gray-500 truncate">{s.organisation}</span>
                        )}
                        {s.is_rewrite && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                            Rewrite
                          </span>
                        )}
                        {s.spec_pasted === true ? (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                            ✓ Spec pasted
                          </span>
                        ) : s.spec_pasted === false ? (
                          <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                            ✗ No spec
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">{s.client?.full_name || 'Unknown'}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs font-mono text-gray-400">{s.client?.client_code}</span>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">{timeAgo(s.created_at)}</span>
                      <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over backdrop */}
      {selectedId && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={closeDetail}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[680px] max-w-full bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          ${selectedId ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: '#0B4F6C' }}
            >
              {detail?.client?.full_name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {detail?.client?.full_name || '…'}
              </p>
              <p className="text-xs text-gray-500 font-mono">{detail?.client?.client_code}</p>
            </div>
          </div>
          <button
            onClick={closeDetail}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 shrink-0 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#0B4F6C' }} />
              <span className="text-sm">Loading statement…</span>
            </div>
          ) : detail ? (
            <>
              {/* Meta info */}
              <div className="px-6 py-4 border-b border-gray-100 space-y-3">
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {detail.job_title || 'Untitled Role'}
                  </p>
                  {detail.organisation && (
                    <p className="text-sm text-gray-600">{detail.organisation}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500">
                  <span>
                    {new Date(detail.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  {detail.is_rewrite && (
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                      Rewrite
                    </span>
                  )}
                  {detail.vacancy_url && (
                    <a
                      href={detail.vacancy_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View job advert
                    </a>
                  )}
                </div>

                {detail.rewrite_instruction && (
                  <div className="bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800 mb-0.5">Rewrite instruction</p>
                    <p className="text-xs text-amber-900">{detail.rewrite_instruction}</p>
                  </div>
                )}

                {/* Person spec compliance */}
                {detail.pasted_person_spec ? (
                  <div className="bg-green-50 border border-green-100 rounded-md px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-green-800">
                        ✓ Person specification pasted — {detail.pasted_person_spec.trim().split(/\s+/).length.toLocaleString()} words
                      </p>
                      <button
                        onClick={() => setShowFullSpec(v => !v)}
                        className="text-xs text-green-700 underline cursor-pointer"
                      >
                        {showFullSpec ? 'Hide' : 'View'}
                      </button>
                    </div>
                    {showFullSpec && (
                      <p className="text-xs text-green-900 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {detail.pasted_person_spec.trim()}
                      </p>
                    )}
                    {!showFullSpec && (
                      <p className="text-xs text-green-800 opacity-70 line-clamp-2">
                        {detail.pasted_person_spec.trim().slice(0, 200)}{detail.pasted_person_spec.length > 200 ? '…' : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-100 rounded-md px-3 py-2">
                    <p className="text-xs font-semibold text-red-700">✗ No person specification was pasted for this statement</p>
                    <p className="text-xs text-red-600 mt-0.5">The statement was generated without a pasted person spec. This may affect quality and coverage.</p>
                  </div>
                )}

                {detail.key_duties && detail.key_duties.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1.5">Key duties extracted</p>
                    <ul className="space-y-0.5">
                      {detail.key_duties.map((d, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-gray-400 shrink-0">·</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Generated statement */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Generated Statement
                </p>
                <StatementContent content={detail.generated_statement || ''} />
              </div>
            </>
          ) : null}
        </div>

        {/* Panel footer */}
        {detail?.generated_statement && (
          <div className="px-6 py-3 border-t border-gray-200 shrink-0">
            <button
              onClick={() => downloadAsWord(
                detail.generated_statement,
                detail.client?.full_name || 'candidate',
                detail.job_title || 'statement',
              )}
              className="w-full py-2 text-sm font-semibold text-white rounded-md cursor-pointer"
              style={{ backgroundColor: '#0B4F6C' }}
            >
              Download Word Doc
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
