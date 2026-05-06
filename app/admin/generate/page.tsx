'use client'
import { useState, useRef } from 'react'
import { useAdminToken } from '@/lib/admin-context'
import { StatementAnalysis } from '@/lib/types'

interface ClientMatch {
  id: string
  client_code: string
  full_name: string
  is_active: boolean
  subscription_end: string
}

interface Result {
  statement: string
  previousRoleDuties: string[]
  currentRoleDuties: string[]
  analysis: StatementAnalysis | null
  jobTitle: string
  organisation: string
  promptRegion: string
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length
}

function downloadAsDoc(result: Result, clientName: string) {
  const stmtHtml = result.statement
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')

  const prevDuties = result.previousRoleDuties.length > 0
    ? `<h2>Key Duties - Previous Role</h2><ol>${result.previousRoleDuties.map((d) => `<li>${d}</li>`).join('')}</ol>`
    : ''

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${result.jobTitle} - ${clientName}</title>
<style>
body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 2.5cm; color: #111; }
h1 { font-size: 16pt; color: #003087; margin-bottom: 4pt; }
h2 { font-size: 12pt; color: #005eb8; margin-top: 20pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }
p { margin: 0 0 10pt 0; }
li { margin-bottom: 4pt; }
</style>
</head>
<body>
<h1>${result.jobTitle}</h1>
<p><em>${result.organisation}</em> &nbsp;|&nbsp; <strong>${clientName}</strong></p>
<h2>Supporting Statement</h2>
${stmtHtml}
${prevDuties}
</body>
</html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${clientName.replace(/\s+/g, '-').toLowerCase()}-${result.jobTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminGeneratePage() {
  const { token } = useAdminToken()

  // Step 1: client search
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ClientMatch[] | null>(null)
  const [searchError, setSearchError] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientMatch | null>(null)

  // Step 2: generate form
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url')
  const [vacancyUrl, setVacancyUrl] = useState('')
  const [jobDescText, setJobDescText] = useState('')
  const [style, setStyle] = useState<'1' | '2'>('1')
  const [applicationMode, setApplicationMode] = useState<'full' | 'questions-only' | 'statement-questions'>('full')
  const [specificQuestions, setSpecificQuestions] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchResults(null)

    try {
      const res = await fetch(`/api/admin/client-lookup?q=${encodeURIComponent(query.trim())}`, {
        headers: { 'x-admin-token': token },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setSearchResults(data.clients)
      if (data.clients.length === 0) setSearchError('No clients found. Try a different name or code.')
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleSelectClient = (client: ClientMatch) => {
    setSelectedClient(client)
    setSearchResults(null)
    setQuery('')
    setError('')
    setResult(null)
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setLoading(false)
    setLoadingStep('')
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return
    if (inputMode === 'url' && !vacancyUrl.trim()) { setError('Paste the job vacancy link'); return }
    if (inputMode === 'text' && jobDescText.trim().split(/\s+/).filter(Boolean).length < 80) {
      setError('Please paste more text from the job advert.'); return
    }

    setLoading(true)
    setError('')
    setResult(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const usedUrl = inputMode === 'url' ? vacancyUrl.trim() : 'text-paste'
    const preloaded = inputMode === 'text'
      ? { jobTitle: '', organisation: '', jobDescription: jobDescText.trim(), personSpec: '', rawText: jobDescText.trim(), source: 'manual' }
      : undefined

    try {
      let scrapeData: Record<string, unknown>

      if (preloaded) {
        scrapeData = preloaded
      } else {
        setLoadingStep('Reading the job advert...')
        const scrapeRes = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_code: selectedClient.client_code, url: usedUrl }),
          signal: controller.signal,
        })
        const scraped = await scrapeRes.json().catch(() => ({ error: 'Server error on scrape.' }))
        if (!scrapeRes.ok) throw new Error(scraped.error || 'Could not read the job advert.')
        scrapeData = scraped
      }

      setLoadingStep('Writing supporting statement...')
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_code: selectedClient.client_code,
          vacancy_url: usedUrl,
          jobData: scrapeData,
          style,
          applicationMode,
          specificQuestions: specificQuestions.trim() || undefined,
        }),
        signal: controller.signal,
      })
      const genData = await genRes.json().catch(() => ({ error: 'Server error on generate.' }))
      if (!genRes.ok) throw new Error(genData.error || 'Failed to generate statement.')
      setResult(genData as Result)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      abortControllerRef.current = null
      setLoading(false)
      setLoadingStep('')
    }
  }

  const wc = result ? wordCount(result.statement) : 0
  const wcLimit = result?.promptRegion === 'scotland' ? 1160 : 1450
  const wcColour = wc > wcLimit ? 'text-red-600 font-bold' : wc > wcLimit * 0.93 ? 'text-amber-600' : 'text-green-700'

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Generate by Applicant</h1>
        <p className="text-sm text-gray-500 mt-1">Search for an applicant by name or code, then generate their statement.</p>
      </div>

      {/* Client search */}
      {!selectedClient && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or enter client code..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-md disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: '#005eb8' }}
            >
              {searching ? 'Searching...' : 'Find'}
            </button>
          </form>

          {searchError && (
            <p className="text-sm text-red-600 mt-3">{searchError}</p>
          )}

          {searchResults && searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectClient(c)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-gray-900 text-sm">{c.full_name}</span>
                  <span className="ml-3 text-xs font-mono text-gray-500">{c.client_code}</span>
                  {!c.is_active && <span className="ml-2 text-xs text-red-500">inactive</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected client + generate form */}
      {selectedClient && !result && (
        <>
          {/* Client badge */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-900">{selectedClient.full_name}</p>
              <p className="text-xs font-mono text-blue-600">{selectedClient.client_code}</p>
            </div>
            <button
              onClick={() => { setSelectedClient(null); setResult(null); setError('') }}
              className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer"
            >
              Change
            </button>
          </div>

          <form onSubmit={handleGenerate} className="space-y-5 bg-white rounded-xl border border-gray-200 p-6">
            {/* Input mode toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job advert source</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { val: 'url' as const, label: 'Paste Link' },
                  { val: 'text' as const, label: 'Paste Text' },
                ]).map(({ val, label }) => (
                  <button key={val} type="button" onClick={() => setInputMode(val)}
                    className="p-3 rounded-md border-2 text-sm font-medium transition-colors text-left"
                    style={inputMode === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff', color: '#003087' } : { borderColor: '#e5e7eb', color: '#374151' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {inputMode === 'url' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Vacancy Link <span className="text-red-500">*</span></label>
                <input type="url" value={vacancyUrl} onChange={(e) => { setVacancyUrl(e.target.value); setError('') }}
                  placeholder="https://www.jobs.nhs.uk/..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2"
                  disabled={loading} />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Description Text <span className="text-red-500">*</span></label>
                <textarea value={jobDescText} onChange={(e) => { setJobDescText(e.target.value); setError('') }}
                  placeholder="Paste the full job description and person specification here..."
                  rows={10} disabled={loading}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none resize-none" />
                <p className="text-xs text-gray-400 mt-1">{jobDescText.trim().split(/\s+/).filter(Boolean).length} words</p>
              </div>
            )}

            {/* Application type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Application Type</label>
              <div className="space-y-2">
                {([
                  { val: 'full' as const, label: 'Full Statement', desc: 'Complete prose statement covering all person spec criteria.' },
                  { val: 'questions-only' as const, label: 'Specific Questions Only', desc: 'Paste questions below, each answered with STAR evidence.' },
                  { val: 'statement-questions' as const, label: 'Full Statement + Extra Questions', desc: 'Full statement then separate question answers.' },
                ] as const).map(({ val, label, desc }) => (
                  <button key={val} type="button" onClick={() => setApplicationMode(val)}
                    className="w-full text-left p-3 rounded-md border-2 transition-colors"
                    style={applicationMode === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff' } : { borderColor: '#e5e7eb' }}>
                    <p className="font-medium text-sm text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Style (England/Wales only) */}
            {applicationMode !== 'questions-only' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Statement Style</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: '1' as const, label: 'Style 1 - Headed Sections' },
                    { val: '2' as const, label: 'Style 2 - Flowing Prose' },
                  ].map(({ val, label }) => (
                    <button key={val} type="button" onClick={() => setStyle(val)}
                      className="p-3 rounded-md border-2 text-sm font-medium text-left transition-colors"
                      style={style === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff' } : { borderColor: '#e5e7eb' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Specific questions */}
            {applicationMode !== 'full' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Application Questions <span className="text-red-500">*</span></label>
                <textarea value={specificQuestions} onChange={(e) => setSpecificQuestions(e.target.value)}
                  placeholder="Paste the application questions here..."
                  rows={5} className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none resize-none"
                  disabled={loading} />
              </div>
            )}

            {error && <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full py-3 text-white font-semibold rounded-md disabled:opacity-60 cursor-pointer transition-colors"
              style={{ backgroundColor: loading ? '#999' : '#005eb8' }}>
              {loading ? `${loadingStep || 'Generating...'}` : 'Generate Statement'}
            </button>

            {loading && (
              <button type="button" onClick={handleCancel}
                className="w-full py-2.5 text-sm font-medium rounded-md border border-red-300 text-red-600 bg-white hover:bg-red-50 cursor-pointer">
                Cancel
              </button>
            )}
          </form>
        </>
      )}

      {/* Result */}
      {result && selectedClient && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-green-800">Statement generated</p>
              <p className="text-xs text-green-700 mt-0.5">{selectedClient.full_name} &mdash; {result.jobTitle}{result.organisation ? `, ${result.organisation}` : ''}</p>
              <p className={`text-xs mt-1 ${wcColour}`}>{wc} words</p>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              <button onClick={() => { navigator.clipboard.writeText(result.statement); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="px-3 py-1.5 text-xs font-medium rounded border border-green-600 text-green-700 hover:bg-green-100 cursor-pointer">
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => downloadAsDoc(result, selectedClient.full_name)}
                className="px-3 py-1.5 text-xs font-medium rounded text-white cursor-pointer"
                style={{ backgroundColor: '#005eb8' }}>
                Download
              </button>
              <button onClick={() => setResult(null)}
                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
                New
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">{result.statement}</pre>
          </div>

          {result.previousRoleDuties.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Key Duties (Previous Role)</h3>
              <ol className="space-y-2">
                {result.previousRoleDuties.map((d, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 font-mono shrink-0">{i + 1}.</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
