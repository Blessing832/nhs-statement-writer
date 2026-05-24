'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { StatementAnalysis } from '@/lib/types'
import { FileDropZone } from '@/components/FileDropZone'

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
    ? `<h2>Key Duties - Previous Role</h2><ol>${result.previousRoleDuties.map((d) => `<li>${d}</li>`).join('')}</ol>`
    : ''

  const currDuties = result.currentRoleDuties.length > 0
    ? `<h2>Key Duties - This Role</h2><ol>${result.currentRoleDuties.map((d) => `<li>${d}</li>`).join('')}</ol>`
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

function AnalysisPanel({ analysis, region }: { analysis: StatementAnalysis | null; region: string }) {
  if (!analysis) return (
    <p className="text-gray-400 text-sm">Person specification not extracted from page. Statement was written from job advert text. If the full PS is in an attached document, the statement should still address it.</p>
  )

  return (
    <div className="space-y-5 text-sm">
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
          <p className="text-gray-600 leading-relaxed">{analysis.jobSummary}</p>
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

function GeneratePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clientCode = searchParams.get('code') || ''

  const [clientName, setClientName] = useState<string | null>(null)
  const [invalidCode, setInvalidCode] = useState(false)
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url')
  const [vacancyUrl, setVacancyUrl] = useState('')
  const [jobDescText, setJobDescText] = useState('')
  const [pastedPersonSpec, setPastedPersonSpec] = useState('')
  const [writerNotes, setWriterNotes] = useState('')
  const [sparsePs, setSparsePs] = useState(false)
  const [downloadedDocs, setDownloadedDocs] = useState<string[]>([])
  const [cachedJobData, setCachedJobData] = useState<Record<string, unknown> | null>(null)
  const [style, setStyle] = useState<'1' | '2'>('1')
  const [bodyPattern, setBodyPattern] = useState<'' | '1' | '2' | '3'>('')
  const [applicationMode, setApplicationMode] = useState<'full' | 'questions-only' | 'statement-questions'>('full')
  const [specificQuestions, setSpecificQuestions] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedDuties, setCopiedDuties] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const [showRewrite, setShowRewrite] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriting, setRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState('')

  const statementRef = useRef<HTMLDivElement>(null)
  const statementHeadRef = useRef<HTMLDivElement>(null)
  const dutiesRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!clientCode) { router.push('/'); return }
    const saved = localStorage.getItem(`writer_notes_${clientCode}`)
    if (saved) setWriterNotes(saved)
    fetch(`/api/client-info?code=${encodeURIComponent(clientCode)}`)
      .then((r) => {
        if (!r.ok) { setInvalidCode(true); return null }
        return r.json()
      })
      .then((d) => { if (d?.full_name) setClientName(d.full_name) })
      .catch(() => {})
  }, [clientCode, router])

  const callGenerate = async (
    body: Record<string, unknown>,
    onStep: (msg: string) => void,
    preloadedJobData?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<{ result: Result; jobData: Record<string, unknown> }> => {
    let scrapeData: Record<string, unknown>

    if (preloadedJobData) {
      scrapeData = preloadedJobData
    } else {
      onStep('Reading job advert & downloading attached documents...')
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: body.client_code, url: body.vacancy_url }),
        signal,
      })
      const scraped = await scrapeRes.json().catch(() => ({ error: 'Server error on scrape.' }))
      if (!scrapeRes.ok) {
        // If a person spec was provided (pasted or uploaded), proceed with it rather than failing
        if (body.pastedPersonSpec) {
          scrapeData = { rawText: '', jobTitle: '', organisation: '', jobDescription: '', personSpec: '', source: 'manual' }
          setSparsePs(false)
        } else {
          throw new Error(scraped.error || 'Could not read the job advert. Please try again.')
        }
      } else {
        scrapeData = scraped
        if (scraped.likelySparsePs) setSparsePs(true)
        if (scraped.downloadedDocs?.length) {
          setDownloadedDocs(scraped.downloadedDocs)
          onStep(`Downloaded ${scraped.downloadedDocs.length} attached document${scraped.downloadedDocs.length > 1 ? 's' : ''} — writing statement...`)
        }
      }
    }

    onStep('Writing your supporting statement...')
    const genRes = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, jobData: scrapeData }),
      signal,
    })
    const genData = await genRes.json().catch(() => ({ error: 'Server error on generate.' }))
    if (!genRes.ok) throw new Error(genData.error || 'Failed to generate statement. Please try again.')

    return { result: genData as Result, jobData: scrapeData }
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setLoading(false)
    setLoadingStep('')
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMode === 'url' && !vacancyUrl.trim()) { setError('Please paste the job vacancy link'); return }
    if (inputMode === 'text') {
      const words = jobDescText.trim().split(/\s+/).filter(Boolean).length
      if (words < 80) { setError('Please paste more text. The full job description should be several paragraphs.'); return }
      const t = jobDescText.toLowerCase()
      const looksLikeJob = t.includes('essential') || t.includes('duties') || t.includes('responsibilities') || t.includes('criteria') || t.includes('person spec') || t.includes('band ') || t.includes('nhs')
      if (!looksLikeJob) { setError('The pasted text does not look like a job advert. Please copy the full page including job description and person specification.'); return }
    }

    setLoading(true)
    setError('')
    setResult(null)
    setCachedJobData(null)
    setDownloadedDocs([])

    const controller = new AbortController()
    abortControllerRef.current = controller

    const usedUrl = inputMode === 'url' ? vacancyUrl.trim() : 'text-paste'
    const preloaded = inputMode === 'text'
      ? { jobTitle: '', organisation: '', jobDescription: jobDescText.trim(), personSpec: '', rawText: jobDescText.trim(), source: 'manual' }
      : undefined

    try {
      const { result: data, jobData } = await callGenerate(
        { client_code: clientCode, vacancy_url: usedUrl, style, applicationMode, specificQuestions: specificQuestions.trim() || undefined, bodyPattern: bodyPattern || undefined, pastedPersonSpec: pastedPersonSpec.trim() || undefined, instructions: writerNotes.trim() || undefined },
        setLoadingStep,
        preloaded,
        controller.signal
      )
      setResult(data)
      setCachedJobData(jobData)
      setShowRewrite(false)
      setRewriteInstruction('')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const raw = err instanceof Error ? err.message : ''
      // iOS Safari throws "Load failed" when a fetch is killed by timeout or network drop
      const isIosTimeout = raw === 'Load failed' || raw.toLowerCase().includes('load failed') || raw.toLowerCase().includes('network request failed')
      setError(
        isIosTimeout
          ? 'The request timed out on your mobile connection. Tap "Paste Job Description" above and paste the job description text directly. This skips the link-reading step and works much faster on phones.'
          : raw || 'Network error. Please check your connection and try again.'
      )
    } finally {
      abortControllerRef.current = null
      setLoading(false)
      setLoadingStep('')
    }
  }

  const handleRewrite = async () => {
    if (!result || !rewriteInstruction.trim()) return
    setRewriting(true)
    setRewriteError('')
    try {
      const usedUrl = inputMode === 'url' ? vacancyUrl.trim() : 'text-paste'
      const { result: data } = await callGenerate(
        {
          client_code: clientCode,
          vacancy_url: usedUrl,
          style,
          specificQuestions: specificQuestions.trim() || undefined,
          rewriteInstruction: rewriteInstruction.trim(),
          previousStatement: result.statement,
          bodyPattern: bodyPattern || undefined,
        },
        () => {},
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

  if (invalidCode) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50">
        <header style={{ backgroundColor: '#003087' }} className="py-4 px-6">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#005eb8' }}>
              <span className="text-white font-bold text-sm">NHS</span>
            </div>
            <span className="text-white font-bold">EaseMe</span>
          </div>
        </header>
        <div style={{ backgroundColor: '#005eb8' }} className="h-1" />
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">🔑</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Code not recognised</h2>
            <p className="text-gray-500 text-sm mb-6">
              The code <span className="font-mono font-semibold text-gray-700">{clientCode}</span> does not match any active account. Check the code your consultant sent you and try again.
            </p>
            <a href="/" className="inline-block w-full py-3 text-white font-semibold rounded-xl text-sm"
              style={{ backgroundColor: '#005eb8' }}>
              Back to login
            </a>
          </div>
        </div>
      </main>
    )
  }

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
          <div className="flex items-center gap-3">
            <div className="text-right">
              {clientName && (
                <p className="text-white text-sm font-semibold leading-tight">{clientName}</p>
              )}
              <p className="text-white text-xs opacity-60 font-mono">{clientCode}</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-3 py-1.5 text-xs text-white border border-white border-opacity-40 rounded hover:bg-white hover:bg-opacity-10 cursor-pointer"
              title="Sign out: you will need to enter your code again"
            >
              Sign Out
            </button>
          </div>
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
                {/* Input mode toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">How would you like to provide the job advert?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { val: 'url' as const, label: 'Paste Link', desc: 'NHS Jobs, HealthJobsUK, etc.' },
                      { val: 'text' as const, label: 'Paste Job Description', desc: 'Copy the text from the page' },
                    ]).map(({ val, label, desc }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setInputMode(val); setError('') }}
                        className="text-left p-3 rounded-md border-2 transition-colors"
                        style={inputMode === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff' } : { borderColor: '#e5e7eb', backgroundColor: 'white' }}
                      >
                        <p className="font-medium text-sm text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {inputMode === 'url' ? (
                  <>
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
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-500 mr-0.5">Depth style:</span>
                      {([
                        { val: '' as const, label: 'Auto', title: 'Best fit chosen for this candidate' },
                        { val: '1' as const, label: '1 – Story-led', title: '2-3 deep narrative scenes; all other paragraphs tight and short' },
                        { val: '2' as const, label: '2 – Evidence-led', title: 'Every paragraph 3-4 sentences, packed with procedures, systems and outcomes' },
                        { val: '3' as const, label: '3 – Reflective', title: 'Medium paragraphs with 1-2 brief reflection sentences after key story outcomes' },
                      ]).map(({ val, label, title }) => (
                        <button
                          key={val || 'auto'}
                          type="button"
                          title={title}
                          onClick={() => setBodyPattern(val)}
                          className="text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
                          style={bodyPattern === val
                            ? { borderColor: '#005eb8', backgroundColor: '#005eb8', color: 'white' }
                            : { borderColor: '#d1d5db', backgroundColor: 'white', color: '#374151' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    {downloadedDocs.length > 0 && (
                      <div className="mb-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                        <strong>✓ Files downloaded and read:</strong>{' '}
                        {downloadedDocs.join(', ')}
                      </div>
                    )}
                    {sparsePs && (
                      <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <strong>Full person spec not found.</strong> The advert page may have fewer criteria than the attached document. Paste the full person spec below for a more complete statement.
                      </div>
                    )}
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Person Specification <span className="text-xs font-normal text-gray-400">(optional)</span>
                    </label>
                    <FileDropZone onText={setPastedPersonSpec} disabled={loading} />
                    <textarea
                      value={pastedPersonSpec}
                      onChange={(e) => setPastedPersonSpec(e.target.value)}
                      placeholder="Or paste person specification criteria here..."
                      rows={4}
                      className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none text-sm resize-y"
                      disabled={loading}
                    />
                  </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job Description Text <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Open the job advert in your browser, select all the text (Ctrl+A then Ctrl+C), and paste it here. Include the job description, person specification, and any Trust values.
                    </p>
                    <textarea
                      value={jobDescText}
                      onChange={(e) => { setJobDescText(e.target.value); setError('') }}
                      placeholder="Paste the full job description here: job title, duties, person specification, essential criteria, desirable criteria, Trust values..."
                      rows={10}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none text-sm resize-none"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-400 mt-1">{jobDescText.trim().split(/\s+/).filter(Boolean).length} words pasted</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Application Type</label>
                  <div className="space-y-2">
                    {([
                      { val: 'full' as const, label: 'Full Statement', desc: 'Complete prose statement covering all person spec criteria.' },
                      { val: 'questions-only' as const, label: 'Specific Questions Only', desc: 'Paste questions below, each answered with STAR evidence (no full statement).' },
                      { val: 'statement-questions' as const, label: 'Full Statement + Extra Questions', desc: 'Full statement then separate answers to specific questions.' },
                    ] as const).map(({ val, label, desc }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setApplicationMode(val)}
                        className={`w-full text-left p-3 rounded-md border-2 transition-colors ${applicationMode === val ? 'border-blue-700 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        style={applicationMode === val ? { borderColor: '#005eb8', backgroundColor: '#f0f7ff' } : {}}
                      >
                        <p className="font-medium text-sm text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {applicationMode !== 'questions-only' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Statement Style</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { val: '1' as const, label: 'Style 1 - Headed Sections', desc: 'Bold headings group related criteria, easy to scan.' },
                        { val: '2' as const, label: 'Style 2 - Flowing Prose', desc: 'Continuous paragraphs, no headings, reads more naturally.' },
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
                )}

                {applicationMode !== 'full' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Application Questions <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={specificQuestions}
                      onChange={(e) => setSpecificQuestions(e.target.value)}
                      placeholder={`Paste the application questions exactly as written:\n1. Tell us about your relevant experience (max 300 words)\n2. Why do you want to work for us?\n3. Describe a time you worked as part of a team.`}
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none text-sm resize-none"
                      disabled={loading}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Writer Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-1.5">Extra context for the AI, e.g. agency NHS experience, specific achievements to highlight, anything not in the profile.</p>
                  <textarea
                    value={writerNotes}
                    onChange={(e) => {
                      setWriterNotes(e.target.value)
                      if (clientCode) localStorage.setItem(`writer_notes_${clientCode}`, e.target.value)
                    }}
                    placeholder="e.g. Candidate worked as an NHS HCA through an agency at Royal Infirmary for 8 months. Include this when addressing experience criteria."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-orange-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-orange-50"
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

                {loading && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full py-2.5 px-6 text-sm font-medium rounded-md border border-red-300 text-red-600 bg-white hover:bg-red-50 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </form>

              {loading && (
                <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
                  <div className="flex items-center gap-5">
                    {/* Document scan animation */}
                    <div className="relative shrink-0 w-14 h-[70px]">
                      <div className="absolute inset-0 rounded border-2 border-blue-300 bg-white" />
                      <div className="absolute top-2 left-2 right-3 space-y-1.5">
                        {[80, 100, 65, 90].map((w, i) => (
                          <div key={i} className="h-1 rounded" style={{ width: `${w}%`, backgroundColor: '#d0e4f8' }} />
                        ))}
                      </div>
                      <div
                        className="absolute left-0 right-0 h-0.5 animate-scan-line"
                        style={{ backgroundColor: '#005eb8', boxShadow: '0 0 6px 2px rgba(0,94,184,0.35)' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        {loadingStep || 'Starting…'}
                      </p>
                      <p className="text-xs text-blue-600">This takes 30–60 seconds. Please keep this tab open.</p>
                      {/* Step dots */}
                      <div className="flex items-center gap-1.5 mt-2.5">
                        {['Reading advert', 'Writing statement', 'Checking criteria'].map((step, i) => {
                          const isReading = loadingStep.includes('Reading')
                          const isWriting = loadingStep.includes('Writing')
                          const active = i === 0 ? isReading || (!isReading && !isWriting) : i === 1 ? isWriting : false
                          return (
                            <div key={step} className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full transition-all duration-300"
                                style={{ backgroundColor: active ? '#005eb8' : '#c0d8f0' }}
                              />
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
                  onClick={() => { downloadAsDoc(result); setDownloaded(true); setTimeout(() => setDownloaded(false), 3000) }}
                  className="text-sm px-3 py-1.5 text-white rounded font-medium cursor-pointer transition-colors"
                  style={{ backgroundColor: downloaded ? '#009639' : '#005eb8' }}
                  onMouseEnter={(e) => { if (!downloaded) e.currentTarget.style.backgroundColor = '#004a9f' }}
                  onMouseLeave={(e) => { if (!downloaded) e.currentTarget.style.backgroundColor = '#005eb8' }}
                >
                  {downloaded ? 'Downloaded!' : 'Download .doc'}
                </button>
                <button
                  onClick={() => { setResult(null); setShowRewrite(false); setRewriteInstruction(''); setVacancyUrl(''); setJobDescText(''); setPastedPersonSpec(''); setSparsePs(false); setDownloadedDocs([]) }}
                  className="text-sm px-3 py-1.5 border border-blue-400 text-blue-100 rounded font-medium hover:bg-blue-800 cursor-pointer"
                >
                  New Statement
                </button>
              </div>
            </div>
          </div>

          {/* Document extraction banner */}
          {(downloadedDocs.length > 0 || sparsePs) && (
            <div className={`px-4 py-2 text-xs flex-shrink-0 flex items-center gap-2 ${downloadedDocs.length > 0 ? 'bg-green-50 border-b border-green-200 text-green-800' : 'bg-amber-50 border-b border-amber-200 text-amber-800'}`}>
              {downloadedDocs.length > 0 ? (
                <>
                  <span className="font-bold">✓ Attached files downloaded and used:</span>
                  <span>{downloadedDocs.join(' · ')}</span>
                </>
              ) : (
                <span><strong>No attached documents found.</strong> Statement based on advert text only. Paste the person spec below for better results.</span>
              )}
            </div>
          )}

          {/* Side by side on desktop, stacked on mobile */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* LEFT: Analysis — full width on mobile, fixed sidebar on desktop */}
            <div className="md:w-80 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white overflow-y-auto">
              <div className="p-5">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide pb-2 border-b border-gray-100">
                  {result.promptRegion === 'scotland' ? 'Person Specification' : 'Pre-Writing Analysis'}
                </h3>
                <AnalysisPanel analysis={result.analysis} region={result.promptRegion} />
              </div>
            </div>

            {/* RIGHT: Statement + duties */}
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
                        title="Jump to duties list"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 border border-blue-200"
                      >
                        Duties
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                <div ref={statementRef}>
                  <StatementDisplay text={result.statement} />
                </div>

                {/* Previous Role Duties */}
                {result.previousRoleDuties?.length > 0 && (
                  <div ref={dutiesRef} className="mt-8 border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-800 text-sm">Key Duties - Previous Role <span className="text-gray-400 font-normal">(past tense)</span></h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const prev = result.previousRoleDuties?.length > 0
                              ? result.previousRoleDuties.map((d, i) => `${i + 1}. ${d}`).join('\n')
                              : ''
                            const curr = result.currentRoleDuties?.length > 0
                              ? result.currentRoleDuties.map((d, i) => `${i + 1}. ${d}`).join('\n')
                              : ''
                            navigator.clipboard.writeText([prev, curr].filter(Boolean).join('\n\n'))
                            setCopiedDuties(true)
                            setTimeout(() => setCopiedDuties(false), 3000)
                          }}
                          className="text-xs px-2 py-1 bg-gray-800 text-white rounded font-medium hover:bg-gray-700 cursor-pointer"
                        >
                          {copiedDuties ? 'Copied!' : 'Copy Duties'}
                        </button>
                        <button
                          onClick={() => statementHeadRef.current?.scrollIntoView({ behavior: 'smooth' })}
                          title="Back to statement"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 border border-blue-200"
                        >
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
                            className="text-xs px-2 py-1 bg-gray-800 text-white rounded font-medium hover:bg-gray-700 cursor-pointer"
                          >
                            {copiedDuties ? 'Copied!' : 'Copy Duties'}
                          </button>
                          <button
                            onClick={() => statementHeadRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            title="Back to statement"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 border border-blue-200"
                          >
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
