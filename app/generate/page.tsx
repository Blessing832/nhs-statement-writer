'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { StatementAnalysis } from '@/lib/types'

interface Result {
  statement: string
  previousRoleDuties: string[]
  currentRoleDuties: string[]
  analysis: StatementAnalysis | null
  jobTitle: string
  organisation: string
  source?: string
  promptRegion: string
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length
}

// Convert **bold** markdown to <strong> for display
function renderBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

// Convert statement text to paragraphs for display
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

function downloadAsDoc(result: Result) {
  const stmtHtml = result.statement
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')

  const prevDuties = result.previousRoleDuties.length > 0
    ? `<h2>Key Duties - Previous Role</h2><ul>${result.previousRoleDuties.map((d) => `<li>${d}</li>`).join('')}</ul>`
    : ''

  const currDuties = result.currentRoleDuties.length > 0
    ? `<h2>Key Duties - This Role</h2><ul>${result.currentRoleDuties.map((d) => `<li>${d}</li>`).join('')}</ul>`
    : ''

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${result.jobTitle}</title>
<style>
body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 2.5cm; color: #111; }
h1 { font-size: 16pt; color: #003087; margin-bottom: 4pt; }
h2 { font-size: 12pt; color: #005eb8; margin-top: 20pt; margin-bottom: 8pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }
p { margin: 0 0 10pt 0; }
ul { margin: 0 0 12pt 16pt; }
li { margin-bottom: 4pt; }
</style>
</head>
<body>
<h1>${result.jobTitle}</h1>
<p><em>${result.organisation}</em></p>
<h2>Supporting Statement</h2>
${stmtHtml}
${prevDuties}
${currDuties}
</body>
</html>`

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${result.jobTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-statement.doc`
  a.click()
  URL.revokeObjectURL(url)
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
        <li key={i} className="flex gap-2 text-gray-700">
          <span className={`flex-shrink-0 mt-0.5 ${colour}`} dangerouslySetInnerHTML={{ __html: icon }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function AnalysisPanel({ analysis }: { analysis: StatementAnalysis | null }) {
  if (!analysis) return <p className="text-gray-400 text-sm">No analysis available.</p>

  return (
    <div className="space-y-5 text-sm">
      {analysis.meetsAllEssential && (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-green-800 text-xs font-medium">
          All essential criteria met
        </div>
      )}

      {analysis.enhancedPreviousTitle && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
          <p className="text-xs text-blue-600 font-medium mb-0.5">Enhanced Previous Title</p>
          <p className="text-blue-800 font-semibold text-sm">{analysis.enhancedPreviousTitle}</p>
        </div>
      )}

      {analysis.jobSummary && (
        <Section title="Role Overview">
          <p className="text-gray-600 leading-relaxed">{analysis.jobSummary}</p>
        </Section>
      )}

      {analysis.advertKeyPhrases?.length ? (
        <Section title="Advert Key Phrases">
          <BulletList items={analysis.advertKeyPhrases} icon="&#8220;" colour="text-purple-400" />
        </Section>
      ) : null}

      {analysis.jdKeywords?.length ? (
        <Section title="JD Keywords">
          <div className="flex flex-wrap gap-1">
            {analysis.jdKeywords.map((k, i) => (
              <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{k}</span>
            ))}
          </div>
        </Section>
      ) : null}

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

      {analysis.subheadingPlan?.length ? (
        <Section title="Subheading Plan">
          <BulletList items={analysis.subheadingPlan} icon="&#8594;" colour="text-gray-400" />
        </Section>
      ) : null}

      {analysis.keyDuties?.length > 0 && (
        <Section title="Key Duties">
          <BulletList items={analysis.keyDuties} icon="&#8226;" colour="" />
        </Section>
      )}

      {analysis.candidateStrengths?.length > 0 && (
        <Section title="Candidate Strengths">
          <BulletList items={analysis.candidateStrengths} icon="&#9733;" colour="text-amber-500" />
        </Section>
      )}

      {analysis.potentialGaps?.length > 0 && (
        <Section title="Areas to Note">
          <BulletList items={analysis.potentialGaps} icon="&#9888;" colour="text-amber-600" />
        </Section>
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
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  const [showRewrite, setShowRewrite] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriting, setRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState('')

  const statementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!clientCode) router.push('/')
  }, [clientCode, router])

  const callGenerate = async (
    body: Record<string, unknown>,
    onProgress: (msg: string) => void
  ): Promise<Result> => {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server error. Please try again.' }))
      throw new Error(err.error || 'Server error. Please try again.')
    }

    if (!res.body) throw new Error('No response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Parse SSE events from buffer
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const block of lines) {
        const dataLine = block.split('\n').find((l) => l.startsWith('data: '))
        if (!dataLine) continue
        let json: Record<string, unknown>
        try {
          json = JSON.parse(dataLine.slice(6))
        } catch {
          continue
        }

        if (json.type === 'progress') {
          onProgress(json.message as string)
        } else if (json.type === 'error') {
          throw new Error(json.error as string)
        } else if (json.type === 'complete') {
          return json as unknown as Result
        }
      }
    }
    throw new Error('The request timed out. The job advert page may be slow - please try again.')
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vacancyUrl.trim()) { setError('Please paste the job vacancy link'); return }

    setLoading(true)
    setError('')
    setResult(null)
    setLoadingStep('Reading the job advert...')

    try {
      const data = await callGenerate(
        {
          client_code: clientCode,
          vacancy_url: vacancyUrl.trim(),
          style,
          specificQuestions: specificQuestions.trim() || undefined,
        },
        setLoadingStep
      )
      setResult(data)
      setShowRewrite(false)
      setRewriteInstruction('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const handleRewrite = async () => {
    if (!result || !rewriteInstruction.trim()) return
    setRewriting(true)
    setRewriteError('')
    try {
      const data = await callGenerate(
        {
          client_code: clientCode,
          vacancy_url: vacancyUrl.trim(),
          style,
          specificQuestions: specificQuestions.trim() || undefined,
          rewriteInstruction: rewriteInstruction.trim(),
          previousStatement: result.statement,
        },
        () => {} // rewrite has no progress display
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
  const wcLimit = result?.promptRegion === 'scotland' ? 1140 : 1450 // Scotland: 450+450+240=1140
  const wcColour = wc > wcLimit ? 'text-red-600 font-bold' : wc > wcLimit * 0.93 ? 'text-amber-600' : 'text-green-700'

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <header style={{ backgroundColor: '#003087' }} className="py-4 px-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ backgroundColor: '#005eb8' }} className="w-10 h-10 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">NHS</span>
            </div>
            <h1 className="text-white text-xl font-semibold">Statement Writer</h1>
          </div>
          <span className="text-white text-sm opacity-75">Code: {clientCode}</span>
        </div>
      </header>
      <div style={{ backgroundColor: '#005eb8' }} className="h-1 flex-shrink-0" />

      {/* Input form */}
      {!result && (
        <div className="flex-1 px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Generate Your Statement</h2>
              <p className="text-gray-500 text-sm mb-6">
                Paste the full job advert link below. Works with NHS Jobs, Health Jobs UK, and NHS Scotland.
              </p>

              <form onSubmit={handleGenerate} className="space-y-5">
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
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Statement Style</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: '1' as const, label: 'Style 1 - Headed Sections', desc: 'Each criterion gets its own heading.' },
                      { val: '2' as const, label: 'Style 2 - Flowing Prose', desc: 'Natural paragraphs without subheadings.' },
                    ].map(({ val, label, desc }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setStyle(val)}
                        className={`text-left p-3 rounded-md border-2 transition-colors ${style === val ? 'border-blue-700 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        style={style === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff' } : {}}
                      >
                        <p className="font-medium text-sm text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Specific Questions <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={specificQuestions}
                    onChange={(e) => setSpecificQuestions(e.target.value)}
                    placeholder={`If the job advert asks specific questions, paste them here:\n1. Tell us about your relevant experience (max 300 words)\n2. Why do you want to work for us?`}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none text-sm resize-none"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">{error}</div>
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
                  <div className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin flex-shrink-0" style={{ borderTopColor: '#005eb8' }} />
                  <span className="text-sm">{loadingStep}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div style={{ backgroundColor: '#003087' }} className="px-4 py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-blue-200 text-xs">Statement generated for</p>
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
                  className="text-sm px-3 py-1.5 bg-white text-gray-800 rounded font-medium hover:bg-gray-100 cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy Statement'}
                </button>
                <button
                  onClick={() => downloadAsDoc(result)}
                  className="text-sm px-3 py-1.5 text-white rounded font-medium cursor-pointer"
                  style={{ backgroundColor: '#005eb8' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#004a9f')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#005eb8')}
                >
                  Download .doc
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

          {/* Side by side on desktop, stacked on mobile */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* LEFT: Analysis — full width on mobile, fixed sidebar on desktop */}
            <div className="md:w-80 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white overflow-y-auto">
              <div className="p-5">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide pb-2 border-b border-gray-100">
                  Pre-Writing Analysis
                </h3>
                <AnalysisPanel analysis={result.analysis} />
              </div>
            </div>

            {/* RIGHT: Statement + duties */}
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-6 max-w-3xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-base">Supporting Statement</h3>
                  <span className={`text-sm tabular-nums ${wcColour}`}>
                    {wc.toLocaleString()} words / {wcLimit.toLocaleString()} max
                  </span>
                </div>

                <div ref={statementRef}>
                  <StatementDisplay text={result.statement} />
                </div>

                {/* Previous Role Duties */}
                {result.previousRoleDuties?.length > 0 && (
                  <div className="mt-8 border-t border-gray-100 pt-6">
                    <h3 className="font-bold text-gray-800 text-sm mb-3">Key Duties - Previous Role <span className="text-gray-400 font-normal">(past tense)</span></h3>
                    <ul className="space-y-1.5">
                      {result.previousRoleDuties.map((d, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-700">
                          <span style={{ color: '#005eb8' }} className="flex-shrink-0 font-bold">&#8226;</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Current Role Duties */}
                {result.currentRoleDuties?.length > 0 && (
                  <div className="mt-6 border-t border-gray-100 pt-6">
                    <h3 className="font-bold text-gray-800 text-sm mb-3">Key Duties - This Role <span className="text-gray-400 font-normal">(present tense)</span></h3>
                    <ul className="space-y-1.5">
                      {result.currentRoleDuties.map((d, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-700">
                          <span style={{ color: '#005eb8' }} className="flex-shrink-0 font-bold">&#8226;</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rewrite */}
                <div className="border-t border-gray-100 pt-6 mt-6">
                  {!showRewrite ? (
                    <button
                      onClick={() => setShowRewrite(true)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer"
                    >
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
                          style={{ backgroundColor: '#005eb8' }}
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
