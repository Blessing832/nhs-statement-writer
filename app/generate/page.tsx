'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { StatementAnalysis } from '@/lib/types'

interface Result {
  statement: string
  duties: string[]
  analysis: StatementAnalysis | null
  jobTitle: string
  organisation: string
  source?: string
  promptRegion: string
}

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

function AnalysisPanel({ analysis, duties }: { analysis: StatementAnalysis | null; duties: string[] }) {
  if (!analysis && duties.length === 0) return null

  return (
    <div className="space-y-5 text-sm">
      {analysis?.jobSummary && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-1 uppercase tracking-wide text-xs">Role Overview</h4>
          <p className="text-gray-600 leading-relaxed">{analysis.jobSummary}</p>
        </div>
      )}

      {analysis?.essentialCriteria && analysis.essentialCriteria.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-2 uppercase tracking-wide text-xs">Essential Criteria</h4>
          <ul className="space-y-1">
            {analysis.essentialCriteria.map((c, i) => (
              <li key={i} className="flex gap-2 text-gray-700">
                <span className="text-green-600 flex-shrink-0 font-bold">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis?.desirableCriteria && analysis.desirableCriteria.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-2 uppercase tracking-wide text-xs">Desirable Criteria</h4>
          <ul className="space-y-1">
            {analysis.desirableCriteria.map((c, i) => (
              <li key={i} className="flex gap-2 text-gray-600">
                <span className="text-blue-500 flex-shrink-0">◦</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(duties.length > 0 || (analysis?.keyDuties && analysis.keyDuties.length > 0)) && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-2 uppercase tracking-wide text-xs">Key Duties</h4>
          <ul className="space-y-1">
            {(analysis?.keyDuties?.length ? analysis.keyDuties : duties).map((d, i) => (
              <li key={i} className="flex gap-2 text-gray-600">
                <span style={{ color: '#005eb8' }} className="flex-shrink-0 font-bold">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis?.candidateStrengths && analysis.candidateStrengths.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-2 uppercase tracking-wide text-xs">Candidate Strengths</h4>
          <ul className="space-y-1">
            {analysis.candidateStrengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-gray-700">
                <span className="text-amber-500 flex-shrink-0">★</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis?.potentialGaps && analysis.potentialGaps.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-2 uppercase tracking-wide text-xs">Areas to Note</h4>
          <ul className="space-y-1">
            {analysis.potentialGaps.map((g, i) => (
              <li key={i} className="flex gap-2 text-amber-700">
                <span className="flex-shrink-0">⚠</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function GeneratePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clientCode = searchParams.get('code') || ''

  const [vacancyUrl, setVacancyUrl] = useState('')
  const [style, setStyle] = useState<'1' | '2'>('1')
  const [specificQuestions, setSpecificQuestions] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  // Rewrite state
  const [showRewrite, setShowRewrite] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriting, setRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState('')

  // Copy state
  const [copied, setCopied] = useState(false)

  const statementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!clientCode) router.push('/')
  }, [clientCode, router])

  const callGenerate = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
    return data as Result
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vacancyUrl.trim()) {
      setError('Please paste the job vacancy link')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setLoadingStep('Reading the job advert...')

    const t1 = setTimeout(() => setLoadingStep('Downloading job description and person specification...'), 4000)
    const t2 = setTimeout(() => setLoadingStep('Analysing person spec and candidate profile...'), 10000)
    const t3 = setTimeout(() => setLoadingStep('Writing your supporting statement...'), 16000)

    try {
      const data = await callGenerate({
        client_code: clientCode,
        vacancy_url: vacancyUrl.trim(),
        style,
        instructions: instructions.trim() || undefined,
        specificQuestions: specificQuestions.trim() || undefined,
      })
      setResult(data)
      setShowRewrite(false)
      setRewriteInstruction('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please check your connection and try again.')
    } finally {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      setLoading(false)
      setLoadingStep('')
    }
  }

  const handleRewrite = async () => {
    if (!result || !rewriteInstruction.trim()) return
    setRewriting(true)
    setRewriteError('')

    try {
      const data = await callGenerate({
        client_code: clientCode,
        vacancy_url: vacancyUrl.trim(),
        style,
        instructions: instructions.trim() || undefined,
        specificQuestions: specificQuestions.trim() || undefined,
        rewriteInstruction: rewriteInstruction.trim(),
        previousStatement: result.statement,
      })
      setResult(data)
      setShowRewrite(false)
      setRewriteInstruction('')
    } catch (err) {
      setRewriteError(err instanceof Error ? err.message : 'Rewrite failed. Please try again.')
    } finally {
      setRewriting(false)
    }
  }

  const handleCopyStatement = () => {
    if (!result) return
    navigator.clipboard.writeText(result.statement)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleDownload = () => {
    if (!result) return
    const regionLabel =
      result.promptRegion === 'scotland'
        ? 'NHS Scotland Application'
        : result.promptRegion === 'england-wales'
        ? 'NHS England/Wales Supporting Statement'
        : 'Supporting Statement'

    const text = [
      regionLabel.toUpperCase(),
      `${result.jobTitle} — ${result.organisation}`,
      '',
      result.statement,
      '',
      'KEY DUTIES AND RESPONSIBILITIES',
      ...result.duties.map((d) => `• ${d}`),
    ].join('\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `statement-${result.jobTitle.replace(/\s+/g, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const wc = result ? wordCount(result.statement) : 0
  const wcLimit =
    result?.promptRegion === 'scotland' ? 1100 : result?.promptRegion === 'england-wales' ? 1300 : 1200
  const wcColour = wc > wcLimit ? 'text-red-600 font-bold' : wc > wcLimit * 0.9 ? 'text-amber-600' : 'text-green-700'

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header style={{ backgroundColor: '#003087' }} className="py-4 px-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              style={{ backgroundColor: '#005eb8' }}
              className="w-10 h-10 rounded flex items-center justify-center"
            >
              <span className="text-white font-bold text-sm">NHS</span>
            </div>
            <h1 className="text-white text-xl font-semibold">Statement Writer</h1>
          </div>
          <span className="text-white text-sm opacity-75">Code: {clientCode}</span>
        </div>
      </header>
      <div style={{ backgroundColor: '#005eb8' }} className="h-1 flex-shrink-0" />

      {/* Input form — only shown when no result */}
      {!result && (
        <div className="flex-1 px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Generate Your Statement</h2>
              <p className="text-gray-500 text-sm mb-6">
                Paste the full job advert link. Works with NHS Jobs, Health Jobs UK, and NHS Scotland.
              </p>

              <form onSubmit={handleGenerate} className="space-y-5">
                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Vacancy Link <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={vacancyUrl}
                    onChange={(e) => { setVacancyUrl(e.target.value); setError('') }}
                    placeholder="https://www.jobs.nhs.uk/candidate/jobadvert/..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                    style={{ '--tw-ring-color': '#005eb8' } as React.CSSProperties}
                    disabled={loading}
                  />
                </div>

                {/* Style selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statement Style
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: '1' as const, label: 'Style 1 — Headed Sections', desc: 'Each criterion gets its own heading. Clear and easy to follow.' },
                      { val: '2' as const, label: 'Style 2 — Flowing Prose', desc: 'Natural, continuous paragraphs without subheadings.' },
                    ].map(({ val, label, desc }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setStyle(val)}
                        className={`text-left p-3 rounded-md border-2 transition-colors ${
                          style === val
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        style={style === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff' } : {}}
                      >
                        <p className="font-medium text-sm text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specific questions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Specific Questions <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={specificQuestions}
                    onChange={(e) => setSpecificQuestions(e.target.value)}
                    placeholder={`Paste specific application questions here if the job advert asks you to answer set questions, e.g.:\n1. Tell us about your relevant experience (max 300 words)\n2. Why do you want to work for our trust? (max 200 words)`}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none text-sm resize-none"
                    disabled={loading}
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Instructions <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Focus on community nursing experience, highlight ward management skills..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none text-sm resize-none"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 text-white font-semibold rounded-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  style={{ backgroundColor: loading ? '#999' : '#005eb8' }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#003087' }}
                  onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#005eb8' }}
                >
                  {loading ? 'Generating...' : 'Generate Statement'}
                </button>
              </form>

              {loading && (
                <div className="mt-5 flex items-center gap-3 text-gray-500">
                  <div
                    className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin flex-shrink-0"
                    style={{ borderTopColor: '#005eb8' }}
                  />
                  <span className="text-sm">{loadingStep}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results — side-by-side layout */}
      {result && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar with job info + actions */}
          <div style={{ backgroundColor: '#003087' }} className="px-4 py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-blue-200 text-xs">Statement generated for</p>
                <h2 className="text-white font-bold text-lg leading-tight">{result.jobTitle}</h2>
                {result.organisation && (
                  <p className="text-blue-200 text-sm">{result.organisation}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {result.promptRegion && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-700 text-blue-100 font-medium">
                    {result.promptRegion === 'scotland'
                      ? 'NHS Scotland'
                      : result.promptRegion === 'england-wales'
                      ? 'NHS England/Wales'
                      : 'Generic'}
                  </span>
                )}
                <button
                  onClick={handleCopyStatement}
                  className="text-sm px-3 py-1.5 bg-white text-gray-800 rounded font-medium hover:bg-gray-100 cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy Statement'}
                </button>
                <button
                  onClick={handleDownload}
                  className="text-sm px-3 py-1.5 text-white rounded font-medium cursor-pointer"
                  style={{ backgroundColor: '#005eb8' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#004a9f')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#005eb8')}
                >
                  Download .txt
                </button>
                <button
                  onClick={() => { setResult(null); setShowRewrite(false); setRewriteInstruction('') }}
                  className="text-sm px-3 py-1.5 border border-blue-400 text-blue-100 rounded font-medium hover:bg-blue-800 cursor-pointer"
                >
                  New Statement
                </button>
              </div>
            </div>
          </div>

          {/* Side-by-side panels */}
          <div className="flex-1 flex overflow-hidden">
            {/* LEFT: Pre-writing analysis */}
            <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
              <div className="p-5">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide pb-2 border-b border-gray-100">
                  Pre-Writing Analysis
                </h3>
                <AnalysisPanel analysis={result.analysis} duties={result.duties} />
              </div>
            </div>

            {/* RIGHT: Statement */}
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-6 max-w-3xl">
                {/* Word count */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-base">Supporting Statement</h3>
                  <span className={`text-sm tabular-nums ${wcColour}`}>
                    {wc.toLocaleString()} words
                    {result.promptRegion !== 'generic' && ` / ${wcLimit.toLocaleString()} max`}
                  </span>
                </div>

                <div ref={statementRef} className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm pb-8">
                  {result.statement}
                </div>

                {/* Rewrite section */}
                <div className="border-t border-gray-100 pt-6 mt-4">
                  {!showRewrite ? (
                    <button
                      onClick={() => setShowRewrite(true)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer"
                    >
                      <span style={{ color: '#005eb8' }}>↺</span>
                      Rewrite with instructions
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-700 text-sm">Rewrite Instructions</h4>
                      <textarea
                        value={rewriteInstruction}
                        onChange={(e) => setRewriteInstruction(e.target.value)}
                        placeholder="e.g. Make it more concise, strengthen the safeguarding section, use more NHS terminology, change the opening paragraph..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none"
                      />
                      {rewriteError && (
                        <p className="text-red-600 text-xs">{rewriteError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleRewrite}
                          disabled={rewriting || !rewriteInstruction.trim()}
                          className="px-4 py-2 text-white text-sm font-medium rounded cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: '#005eb8' }}
                          onMouseEnter={(e) => { if (!rewriting) e.currentTarget.style.backgroundColor = '#003087' }}
                          onMouseLeave={(e) => { if (!rewriting) e.currentTarget.style.backgroundColor = '#005eb8' }}
                        >
                          {rewriting ? 'Rewriting...' : 'Rewrite Statement'}
                        </button>
                        <button
                          onClick={() => { setShowRewrite(false); setRewriteInstruction(''); setRewriteError('') }}
                          className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded cursor-pointer hover:bg-gray-50"
                        >
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

      <footer className="py-3 text-center text-xs text-gray-400 border-t border-gray-200 flex-shrink-0">
        Independent writing tool. Not affiliated with NHS or UK Civil Service.
      </footer>
    </main>
  )
}

export default function GeneratePageWrapper() {
  return (
    <Suspense>
      <GeneratePage />
    </Suspense>
  )
}
