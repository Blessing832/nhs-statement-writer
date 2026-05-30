'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAdminToken } from '@/lib/admin-context'
import { FileDropZone } from '@/components/FileDropZone'
import { ScoringMatrix } from '@/components/ScoringMatrix'
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

function renderBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

function StatementDisplay({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/)
  return (
    <div className="space-y-3 text-gray-800 leading-relaxed text-sm">
      {paragraphs.map((para, i) => {
        const lines = para.split('\n')
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <span dangerouslySetInnerHTML={{ __html: renderBold(line) }} />
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-500 mb-2 uppercase tracking-wide text-xs">{title}</h4>
      {children}
    </div>
  )
}

function BulletList({ items, icon, colour }: { items: string[]; icon: string; colour: string }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-gray-700 text-sm">
          <span className={`flex-shrink-0 mt-0.5 ${colour}`} dangerouslySetInnerHTML={{ __html: icon }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function AnalysisPanel({ analysis, region }: { analysis: StatementAnalysis | null; region: string }) {
  if (!analysis) return (
    <p className="text-gray-400 text-sm">Person specification not extracted. Statement was written from job advert text.</p>
  )
  return (
    <div className="space-y-5 text-sm">
      {analysis.criteriaScores && analysis.criteriaScores.length > 0 && typeof analysis.overallPct === 'number' && (
        <ScoringMatrix scores={analysis.criteriaScores} overallPct={analysis.overallPct} />
      )}
      {analysis.meetsAllEssential && (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-green-800 text-xs font-medium">
          All essential criteria met
        </div>
      )}
      {analysis.enhancedPreviousTitle && region !== 'scotland' && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
          <p className="text-xs text-blue-600 font-medium mb-0.5">Enhanced Previous Title</p>
          <p className="text-blue-800 font-semibold text-sm">{analysis.enhancedPreviousTitle}</p>
        </div>
      )}
      {analysis.jobSummary && region !== 'scotland' && (
        <Section title="Role Overview">
          <p className="text-gray-600 leading-relaxed text-sm">{analysis.jobSummary}</p>
        </Section>
      )}
      {analysis.essentialCriteria?.length > 0 && (
        <Section title={`Essential Criteria (${analysis.essentialCriteria.length})`}>
          <BulletList items={analysis.essentialCriteria} icon="&#10003;" colour="text-green-600 font-bold" />
        </Section>
      )}
      {analysis.desirableCriteria?.length > 0 && (
        <Section title="Desirable Criteria">
          <BulletList items={analysis.desirableCriteria} icon="&#9702;" colour="text-blue-400" />
        </Section>
      )}
    </div>
  )
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

  const currDuties = result.currentRoleDuties.length > 0
    ? `<h2>Key Duties - This Role</h2><ol>${result.currentRoleDuties.map((d) => `<li>${d}</li>`).join('')}</ol>`
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
${currDuties}
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

function AdminGenerateInner() {
  const { token } = useAdminToken()
  const searchParams = useSearchParams()
  const prefillCode = searchParams.get('code')

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
  const [pastedPersonSpec, setPastedPersonSpec] = useState('')
  const [style, setStyle] = useState<'1' | '2'>('1')
  const [bodyPattern, setBodyPattern] = useState<'' | '1' | '2' | '3'>('')
  const [applicationMode, setApplicationMode] = useState<'full' | 'questions-only' | 'statement-questions'>('full')
  const [specificQuestions, setSpecificQuestions] = useState('')
  const [writerNotes, setWriterNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [cachedJobData, setCachedJobData] = useState<Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedDuties, setCopiedDuties] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const [showRewrite, setShowRewrite] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriting, setRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState('')

  const statementHeadRef = useRef<HTMLDivElement>(null)
  const dutiesRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!prefillCode || !token) return
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/client-lookup?q=${encodeURIComponent(prefillCode)}`, {
          headers: { 'x-admin-token': token },
        })
        const data = await res.json()
        if (res.ok && data.clients?.length > 0) {
          const exact = data.clients.find((c: ClientMatch) => c.client_code === prefillCode.toUpperCase()) ?? data.clients[0]
          setSelectedClient(exact)
        }
      } catch { /* ignore */ }
    })()
  }, [prefillCode, token])

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

  const runGenerate = async (
    body: Record<string, unknown>,
    preloadedJobData?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<{ result: Result; jobData: Record<string, unknown> }> => {
    let scrapeData: Record<string, unknown>
    if (preloadedJobData) {
      scrapeData = preloadedJobData
    } else {
      setLoadingStep('Reading the job advert...')
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: body.client_code, url: body.vacancy_url }),
        signal,
      })
      const scraped = await scrapeRes.json().catch(() => ({ error: 'Server error on scrape.' }))
      if (!scrapeRes.ok) {
        if (body.pastedPersonSpec) {
          scrapeData = { rawText: '', jobTitle: '', organisation: '', jobDescription: '', personSpec: '', source: 'manual' }
        } else {
          throw new Error(scraped.error || 'Could not read the job advert.')
        }
      } else {
        scrapeData = scraped
      }
    }
    setLoadingStep('Writing supporting statement...')
    const genRes = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, jobData: scrapeData }),
      signal,
    })
    const genData = await genRes.json().catch(() => ({ error: 'Server error on generate.' }))
    if (!genRes.ok) {
      const genErr = typeof genData.error === 'string' ? genData.error : (genData.error?.message || genData.message || '')
      throw new Error(genErr || 'Failed to generate statement.')
    }
    return { result: genData as Result, jobData: scrapeData }
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
    setCachedJobData(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const usedUrl = inputMode === 'url' ? vacancyUrl.trim() : 'text-paste'
    const preloaded = inputMode === 'text'
      ? { jobTitle: '', organisation: '', jobDescription: jobDescText.trim(), personSpec: '', rawText: jobDescText.trim(), source: 'manual' }
      : undefined

    try {
      const { result: data, jobData } = await runGenerate(
        { client_code: selectedClient.client_code, vacancy_url: usedUrl, style, applicationMode, specificQuestions: specificQuestions.trim() || undefined, bodyPattern: bodyPattern || undefined, pastedPersonSpec: pastedPersonSpec.trim() || undefined, instructions: writerNotes.trim() || undefined },
        preloaded,
        controller.signal
      )
      setResult(data)
      setCachedJobData(jobData)
      setShowRewrite(false)
      setRewriteInstruction('')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      abortControllerRef.current = null
      setLoading(false)
      setLoadingStep('')
    }
  }

  const handleRewrite = async () => {
    if (!result || !rewriteInstruction.trim() || !selectedClient) return
    setRewriting(true)
    setRewriteError('')
    try {
      const usedUrl = inputMode === 'url' ? vacancyUrl.trim() : 'text-paste'
      const { result: data } = await runGenerate(
        {
          client_code: selectedClient.client_code,
          vacancy_url: usedUrl,
          style,
          specificQuestions: specificQuestions.trim() || undefined,
          rewriteInstruction: rewriteInstruction.trim(),
          previousStatement: result.statement,
          bodyPattern: bodyPattern || undefined,
        },
        cachedJobData ?? undefined
      )
      setResult(data)
      setShowRewrite(false)
      setRewriteInstruction('')
    } catch (err) {
      setRewriteError(err instanceof Error ? err.message : 'Rewrite failed. Please try again.')
    } finally {
      setRewriting(false)
    }
  }

  const wc = result ? wordCount(result.statement) : 0
  const wcLimit = result?.promptRegion === 'scotland' ? 1160 : 1450
  const wcColour = wc > wcLimit ? 'text-red-600 font-bold' : wc > wcLimit * 0.93 ? 'text-amber-600' : 'text-green-700'

  return (
    <div className="flex flex-col min-h-0">
      {/* ─── CLIENT SEARCH ─── */}
      {!selectedClient && (
        <div className="max-w-3xl mx-auto w-full px-6 py-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Generate by Applicant</h1>
            <p className="text-sm text-gray-500 mt-1">Search by name or client code, then generate their statement.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
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
            {searchError && <p className="text-sm text-red-600 mt-3">{searchError}</p>}
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
        </div>
      )}

      {/* ─── GENERATE FORM ─── */}
      {selectedClient && !result && (
        <div className="max-w-3xl mx-auto w-full px-6 py-8">
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

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <form onSubmit={handleGenerate} className="space-y-5">
              {/* Input mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Job advert source</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: 'url' as const, label: 'Paste Link', desc: 'NHS Jobs, HealthJobsUK, etc.' },
                    { val: 'text' as const, label: 'Paste Text', desc: 'Copy text from the page' },
                  ]).map(({ val, label, desc }) => (
                    <button key={val} type="button" onClick={() => setInputMode(val)}
                      className="p-3 rounded-md border-2 text-sm text-left transition-colors"
                      style={inputMode === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff', color: '#003087' } : { borderColor: '#e5e7eb', color: '#374151' }}>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {inputMode === 'url' ? (
                <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Vacancy Link <span className="text-red-500">*</span></label>
                  <input type="url" value={vacancyUrl} onChange={(e) => { setVacancyUrl(e.target.value); setError('') }}
                    placeholder="https://www.jobs.nhs.uk/..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={loading} />
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-500 mr-0.5">Depth style:</span>
                    {([
                      { val: '' as const, label: 'Auto', title: 'Best fit chosen for this candidate' },
                      { val: '1' as const, label: '1 – Story-led', title: '2-3 deep narrative scenes; all other paragraphs tight and short' },
                      { val: '2' as const, label: '2 – Evidence-led', title: 'Every paragraph 3-4 sentences, packed with procedures, systems and outcomes' },
                      { val: '3' as const, label: '3 – Reflective', title: 'Medium paragraphs with 1-2 brief reflection sentences after key story outcomes' },
                    ]).map(({ val, label, title }) => (
                      <button key={val || 'auto'} type="button" title={title} onClick={() => setBodyPattern(val)}
                        className="text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
                        style={bodyPattern === val
                          ? { borderColor: '#005eb8', backgroundColor: '#005eb8', color: 'white' }
                          : { borderColor: '#d1d5db', backgroundColor: 'white', color: '#374151' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Person Specification <span className="text-xs font-normal text-gray-400">(optional)</span>
                  </label>
                  <FileDropZone onText={setPastedPersonSpec} disabled={loading} />
                  <textarea
                    value={pastedPersonSpec}
                    onChange={(e) => setPastedPersonSpec(e.target.value)}
                    placeholder="Or paste person specification criteria here..."
                    rows={4}
                    className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none resize-y"
                    disabled={loading}
                  />
                </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Description Text <span className="text-red-500">*</span></label>
                  <p className="text-xs text-gray-500 mb-2">Select all text on the job page (Ctrl+A then Ctrl+C) and paste here. Or drop a PDF/Word file below.</p>
                  <FileDropZone onText={(t) => { setJobDescText(t); setError('') }} disabled={loading} />
                  <textarea value={jobDescText} onChange={(e) => { setJobDescText(e.target.value); setError('') }}
                    placeholder="Paste the full job description and person specification here..."
                    rows={10} disabled={loading}
                    className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none resize-none" />
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

              {/* Style */}
              {applicationMode !== 'questions-only' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Statement Style</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: '1' as const, label: 'Style 1 - Headed Sections', desc: 'Bold headings group related criteria, easy to scan.' },
                      { val: '2' as const, label: 'Style 2 - Flowing Prose', desc: 'Continuous paragraphs, no headings, reads more naturally.' },
                    ].map(({ val, label, desc }) => (
                      <button key={val} type="button" onClick={() => setStyle(val)}
                        className="p-3 rounded-md border-2 text-sm text-left transition-colors"
                        style={style === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff' } : { borderColor: '#e5e7eb' }}>
                        <p className="font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions */}
              {applicationMode !== 'full' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Application Questions <span className="text-red-500">*</span></label>
                  <textarea value={specificQuestions} onChange={(e) => setSpecificQuestions(e.target.value)}
                    placeholder={`Paste the application questions exactly as written:\n1. Tell us about your relevant experience\n2. Why do you want to work for us?`}
                    rows={5} className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none resize-none"
                    disabled={loading} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Writer Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <p className="text-xs text-gray-500 mb-1.5">Extra context for the AI, e.g. agency NHS experience, specific achievements to highlight, anything not in the profile.</p>
                <textarea value={writerNotes} onChange={(e) => setWriterNotes(e.target.value)}
                  placeholder="e.g. Candidate worked as an NHS HCA through an agency at Royal Infirmary for 8 months. Include this when addressing experience criteria."
                  rows={3} className="w-full px-4 py-2.5 border border-orange-300 rounded-md text-sm focus:outline-none resize-none bg-orange-50"
                  disabled={loading} />
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">{error}</div>}

              <button type="submit" disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-md disabled:opacity-60 cursor-pointer transition-colors"
                style={{ backgroundColor: loading ? '#999' : '#005eb8' }}>
                {loading ? (loadingStep || 'Generating...') : 'Generate Statement'}
              </button>

              {loading && (
                <button type="button" onClick={handleCancel}
                  className="w-full py-2.5 text-sm font-medium rounded-md border border-red-300 text-red-600 bg-white hover:bg-red-50 cursor-pointer">
                  Cancel
                </button>
              )}
            </form>

            {loading && (
              <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0 w-14 h-[70px]">
                    <div className="absolute inset-0 rounded border-2 border-blue-300 bg-white" />
                    <div className="absolute top-2 left-2 right-3 space-y-1.5">
                      {[80, 100, 65, 90].map((w, i) => (
                        <div key={i} className="h-1 rounded" style={{ width: `${w}%`, backgroundColor: '#d0e4f8' }} />
                      ))}
                    </div>
                    <div className="absolute left-0 right-0 h-0.5 animate-scan-line"
                      style={{ backgroundColor: '#005eb8', boxShadow: '0 0 6px 2px rgba(0,94,184,0.35)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-900 mb-1">{loadingStep || 'Starting...'}</p>
                    <p className="text-xs text-blue-600">This takes 30-60 seconds. Please keep this tab open.</p>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      {['Reading advert', 'Writing statement', 'Checking criteria'].map((step, i) => {
                        const isReading = loadingStep.includes('Reading')
                        const isWriting = loadingStep.includes('Writing')
                        const active = i === 0 ? isReading || (!isReading && !isWriting) : i === 1 ? isWriting : false
                        return (
                          <div key={step} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full transition-all duration-300"
                              style={{ backgroundColor: active ? '#005eb8' : '#c0d8f0' }} />
                            {i < 2 && <div className="w-6 h-px" style={{ backgroundColor: '#c0d8f0' }} />}
                          </div>
                        )
                      })}
                      <span className="text-xs text-blue-500 ml-1">
                        {loadingStep.includes('Reading') ? 'Step 1 of 2' : 'Step 2 of 2'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESULTS */}
      {result && selectedClient && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top bar */}
          <div style={{ backgroundColor: '#003087' }} className="px-4 py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-blue-200 text-xs">{selectedClient.full_name} · {selectedClient.client_code}</p>
                <h2 className="text-white font-bold text-base sm:text-lg leading-tight truncate">{result.jobTitle}</h2>
                {result.organisation && <p className="text-blue-200 text-sm truncate">{result.organisation}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                {result.promptRegion && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-700 text-blue-100 font-medium">
                    {result.promptRegion === 'scotland' ? 'NHS Scotland' : result.promptRegion === 'england-wales' ? 'NHS England/Wales' : 'Generic'}
                  </span>
                )}
                <button
                  onClick={() => { navigator.clipboard.writeText(result.statement); setCopied(true); setTimeout(() => setCopied(false), 3000) }}
                  className="text-sm px-3 py-1.5 bg-white text-gray-800 rounded font-medium hover:bg-gray-100 cursor-pointer">
                  {copied ? 'Copied!' : 'Copy Statement'}
                </button>
                <button
                  onClick={() => { downloadAsDoc(result, selectedClient.full_name); setDownloaded(true); setTimeout(() => setDownloaded(false), 3000) }}
                  className="text-sm px-3 py-1.5 text-white rounded font-medium cursor-pointer transition-colors"
                  style={{ backgroundColor: downloaded ? '#009639' : '#005eb8' }}>
                  {downloaded ? 'Downloaded!' : 'Download .doc'}
                </button>
                <button
                  onClick={() => { setResult(null); setShowRewrite(false); setRewriteInstruction(''); setVacancyUrl(''); setJobDescText(''); setPastedPersonSpec('') }}
                  className="text-sm px-3 py-1.5 border border-blue-400 text-blue-100 rounded font-medium hover:bg-blue-800 cursor-pointer">
                  New Statement
                </button>
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
            {/* LEFT: Analysis sidebar */}
            <div className="md:w-80 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white overflow-y-auto">
              <div className="p-5">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide pb-2 border-b border-gray-100">
                  {result.promptRegion === 'scotland' ? 'Person Specification' : 'Pre-Writing Analysis'}
                </h3>
                <AnalysisPanel analysis={result.analysis} region={result.promptRegion} />
              </div>
            </div>

            {/* RIGHT: Statement + duties + rewrite */}
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-6 max-w-3xl">
                <div ref={statementHeadRef} className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-base">Supporting Statement</h3>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm tabular-nums ${wcColour}`}>
                      {wc.toLocaleString()} words / {wcLimit.toLocaleString()} max
                    </span>
                    {(result.previousRoleDuties?.length > 0 || result.currentRoleDuties?.length > 0) && (
                      <button
                        onClick={() => dutiesRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 border border-blue-200">
                        Duties
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                <StatementDisplay text={result.statement} />

                {/* Previous Role Duties */}
                {result.previousRoleDuties?.length > 0 && (
                  <div ref={dutiesRef} className="mt-8 border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-800 text-sm">Key Duties - Previous Role <span className="text-gray-400 font-normal">(past tense)</span></h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const prev = result.previousRoleDuties.map((d, i) => `${i + 1}. ${d}`).join('\n')
                            const curr = result.currentRoleDuties?.length > 0
                              ? result.currentRoleDuties.map((d, i) => `${i + 1}. ${d}`).join('\n')
                              : ''
                            navigator.clipboard.writeText([prev, curr].filter(Boolean).join('\n\n'))
                            setCopiedDuties(true)
                            setTimeout(() => setCopiedDuties(false), 3000)
                          }}
                          className="text-xs px-2 py-1 bg-gray-800 text-white rounded font-medium hover:bg-gray-700 cursor-pointer">
                          {copiedDuties ? 'Copied!' : 'Copy Duties'}
                        </button>
                        <button
                          onClick={() => statementHeadRef.current?.scrollIntoView({ behavior: 'smooth' })}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 border border-blue-200">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                          Top
                        </button>
                      </div>
                    </div>
                    <ol className="space-y-1.5 list-none">
                      {result.previousRoleDuties.map((d, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                          <span style={{ color: '#005eb8' }} className="flex-shrink-0 font-bold min-w-[1.2rem]">{i + 1}.</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Current Role Duties */}
                {result.currentRoleDuties?.length > 0 && (
                  <div ref={result.previousRoleDuties?.length > 0 ? undefined : dutiesRef} className="mt-6 border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-800 text-sm">Key Duties - This Role <span className="text-gray-400 font-normal">(present tense)</span></h3>
                      {result.previousRoleDuties?.length === 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const curr = result.currentRoleDuties.map((d, i) => `${i + 1}. ${d}`).join('\n')
                              navigator.clipboard.writeText(curr)
                              setCopiedDuties(true)
                              setTimeout(() => setCopiedDuties(false), 3000)
                            }}
                            className="text-xs px-2 py-1 bg-gray-800 text-white rounded font-medium hover:bg-gray-700 cursor-pointer">
                            {copiedDuties ? 'Copied!' : 'Copy Duties'}
                          </button>
                          <button
                            onClick={() => statementHeadRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 border border-blue-200">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                            Top
                          </button>
                        </div>
                      )}
                    </div>
                    <ol className="space-y-1.5 list-none">
                      {result.currentRoleDuties.map((d, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                          <span style={{ color: '#005eb8' }} className="flex-shrink-0 font-bold min-w-[1.2rem]">{i + 1}.</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Rewrite */}
                <div className="border-t border-gray-100 pt-6 mt-6">
                  {!showRewrite ? (
                    <button
                      onClick={() => setShowRewrite(true)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer">
                      <span style={{ color: '#005eb8' }}>&#8635;</span>
                      Rewrite with instructions
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-700 text-sm">Rewrite Instructions</h4>
                      <textarea
                        value={rewriteInstruction}
                        onChange={(e) => setRewriteInstruction(e.target.value)}
                        placeholder="e.g. Make it more concise, strengthen the safeguarding section, change the opening paragraph..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none"
                      />
                      {rewriteError && <p className="text-red-600 text-xs">{rewriteError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleRewrite}
                          disabled={rewriting || !rewriteInstruction.trim()}
                          className="px-4 py-2 text-white text-sm font-medium rounded cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: '#005eb8' }}>
                          {rewriting ? 'Rewriting...' : 'Rewrite Statement'}
                        </button>
                        <button
                          onClick={() => { setShowRewrite(false); setRewriteInstruction(''); setRewriteError('') }}
                          className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded cursor-pointer hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminGeneratePage() {
  return (
    <Suspense>
      <AdminGenerateInner />
    </Suspense>
  )
}
