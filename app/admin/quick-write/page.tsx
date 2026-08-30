'use client'
import { useState, useRef } from 'react'
import { useAdminToken } from '@/lib/admin-context'
import { FileDropZone } from '@/components/FileDropZone'
import { StatementAnalysis } from '@/lib/types'

interface Result {
  statement: string
  previousRoleDuties: string[]
  currentRoleDuties: string[]
  analysis: StatementAnalysis | null
  jobTitle: string
  organisation: string
  promptRegion: string
  cachedJobData: Record<string, unknown>
}

const FIELD_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical'

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

function downloadAsDoc(result: Result, candidateName: string) {
  const stmtHtml = result.statement
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')

  const prevDuties = result.previousRoleDuties?.length > 0
    ? `<h2>Key Duties - Previous Role</h2><ol>${result.previousRoleDuties.map((d) => `<li>${d}</li>`).join('')}</ol>`
    : ''
  const currDuties = result.currentRoleDuties?.length > 0
    ? `<h2>Key Duties - This Role</h2><ol>${result.currentRoleDuties.map((d) => `<li>${d}</li>`).join('')}</ol>`
    : ''

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${result.jobTitle} - ${candidateName}</title>
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
<p><em>${result.organisation}</em> &nbsp;|&nbsp; <strong>${candidateName}</strong></p>
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
  a.download = `${candidateName.replace(/\s+/g, '-').toLowerCase()}-${result.jobTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

export default function QuickWritePage() {
  const { token } = useAdminToken()

  const [inputMode, setInputMode] = useState<'url' | 'text'>('url')
  const [jobDescText, setJobDescText] = useState('')

  const [form, setForm] = useState({
    name: '',
    work_history: '',
    qualifications: '',
    skills: '',
    background: '',
    vacancy_url: '',
    person_spec: '',
    instructions: '',
    style: '1' as '1' | '2',
    applicationMode: 'full' as 'full' | 'questions-only' | 'statement-questions',
    bodyPattern: '' as '' | '1' | '2' | '3',
    openingTemplate: '' as '' | '1' | '2' | '3' | '4' | '5',
  })

  const [specificQuestions, setSpecificQuestions] = useState<string[]>([''])
  const questionsText = () =>
    specificQuestions.filter(q => q.trim()).map((q, i) => `${i + 1}. ${q.trim()}`).join('\n')
  const addQuestion = () => setSpecificQuestions(prev => [...prev, ''])
  const updateQuestion = (i: number, val: string) =>
    setSpecificQuestions(prev => prev.map((q, idx) => idx === i ? val : q))
  const removeQuestion = (i: number) =>
    setSpecificQuestions(prev => prev.filter((_, idx) => idx !== i))

  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedDuties, setCopiedDuties] = useState(false)

  const [showRewrite, setShowRewrite] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriting, setRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState('')

  const statementHeadRef = useRef<HTMLDivElement>(null)
  const dutiesRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const callApi = async (extra: Record<string, unknown> = {}, signal?: AbortSignal): Promise<Result> => {
    setLoadingStep('Reading the job advert & generating statement...')
    const res = await fetch('/api/admin/quick-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ ...form, jobDescText: inputMode === 'text' ? jobDescText : undefined, specificQuestions: questionsText() || undefined, ...extra }),
      signal,
    })
    const data = await res.json().catch(() => ({ error: 'Server error.' }))
    if (!res.ok) {
      const errMsg = typeof data.error === 'string' ? data.error : (data.error?.message || data.message || '')
      throw new Error(errMsg || 'Something went wrong')
    }
    return data as Result
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (inputMode === 'text' && jobDescText.trim().split(/\s+/).filter(Boolean).length < 80) {
      setError('Please paste at least 80 words of job description text.')
      return
    }
    setResult(null)
    setLoading(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const data = await callApi({}, controller.signal)
      setResult(data)
      setShowRewrite(false)
      setRewriteInstruction('')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Network error, please try again')
    } finally {
      abortControllerRef.current = null
      setLoading(false)
      setLoadingStep('')
    }
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setLoading(false)
    setLoadingStep('')
  }

  const handleRewrite = async () => {
    if (!result || !rewriteInstruction.trim()) return
    setRewriting(true)
    setRewriteError('')
    try {
      const data = await callApi({
        cachedJobData: result.cachedJobData,
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

  const wc = result ? wordCount(result.statement) : 0
  const wcLimit = result?.promptRegion === 'scotland' ? 1160 : 1450
  const wcColour = wc > wcLimit ? 'text-red-600 font-bold' : wc > wcLimit * 0.93 ? 'text-amber-600' : 'text-green-700'

  return (
    <div className="flex flex-col min-h-0">
      {/* ─── FORM ─── */}
      {!result && (
        <div className="max-w-3xl mx-auto w-full px-6 py-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Quick Statement Writer</h1>
            <p className="text-sm text-gray-500 mt-1">
              One-time use: paste a candidate&apos;s background and job link. Nothing is saved.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-gray-200 p-6">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Candidate name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.name} onChange={set('name')} required
                placeholder="e.g. Jane Smith" className={FIELD_CLASS} />
            </div>

            {/* Job input mode toggle */}
            <div>
              <div className="flex gap-1.5 mb-3">
                {([
                  { val: 'url' as const, label: 'Paste Link' },
                  { val: 'text' as const, label: 'Paste Job Description' },
                ] as const).map(({ val, label }) => (
                  <button key={val} type="button" onClick={() => setInputMode(val)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer"
                    style={inputMode === val
                      ? { borderColor: '#0B4F6C', backgroundColor: '#0B4F6C', color: 'white' }
                      : { borderColor: '#d1d5db', backgroundColor: 'white', color: '#374151' }}>
                    {label}
                  </button>
                ))}
              </div>

              {inputMode === 'url' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Job advert URL <span className="text-red-500">*</span>
                  </label>
                  <input type="url" value={form.vacancy_url} onChange={set('vacancy_url')}
                    required={inputMode === 'url'}
                    placeholder="https://www.jobs.nhs.uk/..." className={FIELD_CLASS} />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Job Description Text <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Drop a PDF/Word file or paste the full job advert text below.</p>
                  <FileDropZone onText={(t) => { setJobDescText(t); setError('') }} disabled={loading} />
                  <textarea value={jobDescText} onChange={(e) => { setJobDescText(e.target.value); setError('') }}
                    placeholder="Paste the full job description here: job title, duties, person specification, essential criteria, desirable criteria..."
                    rows={8} disabled={loading}
                    className={`${FIELD_CLASS} mt-2`} />
                  <p className="text-xs text-gray-400 mt-1">{jobDescText.trim().split(/\s+/).filter(Boolean).length} words pasted</p>
                </div>
              )}
            </div>

            {/* Opening style */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500 mr-0.5">Opening style:</span>
              {([
                { val: '' as const, label: 'Auto', title: 'AI picks the opening automatically' },
                { val: '1' as const, label: '1', title: '"After carefully going through the job advert and person specification list, I am writing to apply for the [vacancy title]..."' },
                { val: '2' as const, label: '2', title: '"Having worked as a [role] for [X] years, I believe taking up the role of [vacancy title] within [Trust] is the natural next step..."' },
                { val: '3' as const, label: '3', title: '"I am writing to apply for the position of [vacancy title]..."' },
                { val: '4' as const, label: '4', title: '"Having cared for people with [condition] for over [X] years, I believe I have the necessary skills to take up the role of [vacancy title]..."' },
                { val: '5' as const, label: '5', title: '"My background and experience match the requirements of the role of [vacancy title]..."' },
              ]).map(({ val, label, title }) => (
                <button key={val || 'auto'} type="button" title={title}
                  onClick={() => setForm(f => ({ ...f, openingTemplate: val }))}
                  className="text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
                  style={form.openingTemplate === val
                    ? { borderColor: '#0B4F6C', backgroundColor: '#0B4F6C', color: 'white' }
                    : { borderColor: '#d1d5db', backgroundColor: 'white', color: '#374151' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Work history */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Work history</label>
              <textarea value={form.work_history} onChange={set('work_history')} rows={5}
                placeholder="Job titles, employers, dates, key duties..." className={FIELD_CLASS} />
            </div>

            {/* Qualifications + Skills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Qualifications</label>
                <textarea value={form.qualifications} onChange={set('qualifications')} rows={4}
                  placeholder="Degrees, NVQs, GCSEs, care certificates..." className={FIELD_CLASS} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Skills</label>
                <textarea value={form.skills} onChange={set('skills')} rows={4}
                  placeholder="IT systems, clinical skills, languages..." className={FIELD_CLASS} />
              </div>
            </div>

            {/* Background */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Additional background</label>
              <textarea value={form.background} onChange={set('background')} rows={3}
                placeholder="Immigration status, gaps, special context..." className={FIELD_CLASS} />
            </div>

            {/* Person Spec */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Person Specification <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <FileDropZone onText={(text) => setForm(f => ({ ...f, person_spec: text }))} disabled={loading} />
              <textarea value={form.person_spec} onChange={set('person_spec')} rows={4}
                placeholder="Or paste the person spec criteria here..."
                className={`${FIELD_CLASS} mt-2`} disabled={loading} />
            </div>

            {/* Application Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Application Type</label>
              <div className="space-y-2">
                {([
                  { val: 'full' as const, label: 'Full Statement', desc: 'Complete prose statement covering all person spec criteria.' },
                  { val: 'questions-only' as const, label: 'Specific Questions Only', desc: 'Paste questions below, each answered with STAR evidence.' },
                  { val: 'statement-questions' as const, label: 'Full Statement + Extra Questions', desc: 'Full statement then separate question answers.' },
                ] as const).map(({ val, label, desc }) => (
                  <button key={val} type="button"
                    onClick={() => setForm(f => ({ ...f, applicationMode: val }))}
                    className="w-full text-left p-3 rounded-md border-2 transition-colors"
                    style={form.applicationMode === val ? { borderColor: '#0B4F6C', backgroundColor: '#f0f7ff' } : { borderColor: '#e5e7eb' }}>
                    <p className="font-medium text-sm text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Statement style */}
            {form.applicationMode !== 'questions-only' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Statement Style</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: '1' as const, label: 'Style 1 – Headed Sections', desc: 'Bold headings group related criteria.' },
                    { val: '2' as const, label: 'Style 2 – Flowing Prose', desc: 'Continuous paragraphs, no headings.' },
                  ].map(({ val, label, desc }) => (
                    <button key={val} type="button" onClick={() => setForm(f => ({ ...f, style: val }))}
                      className="p-3 rounded-md border-2 text-sm text-left transition-colors"
                      style={form.style === val ? { borderColor: '#0B4F6C', backgroundColor: '#f0f7ff' } : { borderColor: '#e5e7eb' }}>
                      <p className="font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Specific questions */}
            {form.applicationMode !== 'full' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Application Questions <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 -mt-0.5 mb-2">One question per box. If a question has multiple parts, paste them all in one box.</p>
                <div className="space-y-3">
                  {specificQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-7 pt-3 text-sm font-bold text-gray-400 text-center">
                        {i + 1}.
                      </span>
                      <textarea value={q} onChange={(e) => updateQuestion(i, e.target.value)}
                        placeholder={`Type or paste question ${i + 1} here — including any sub-points…`}
                        rows={3} disabled={loading}
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none resize-y" />
                      {specificQuestions.length > 1 && (
                        <button type="button" onClick={() => removeQuestion(i)}
                          className="flex-shrink-0 w-8 pt-2.5 flex items-start justify-center text-gray-300 hover:text-red-400 cursor-pointer text-xl leading-none">
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addQuestion}
                  className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer pt-3"
                  style={{ color: '#0B4F6C' }}>
                  <span className="text-lg leading-none">+</span> Add question
                </button>
              </div>
            )}

            {/* Writer Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Writer Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <p className="text-xs text-gray-500 mb-1">Extra context for the AI, e.g. agency NHS experience, specific achievements, anything not in the profile above.</p>
              <textarea value={form.instructions} onChange={set('instructions')} rows={3}
                placeholder="e.g. Candidate worked as an NHS HCA through an agency at Royal Infirmary for 8 months. Include this when addressing experience criteria."
                className="w-full px-3 py-2 border border-orange-300 rounded text-xs focus:outline-none resize-none bg-orange-50" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white rounded-md cursor-pointer disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: loading ? '#64748b' : '#0B4F6C' }}>
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
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center gap-5">
                <div className="relative shrink-0 w-14 h-[70px]">
                  <div className="absolute inset-0 rounded border-2 border-blue-300 bg-white" />
                  <div className="absolute top-2 left-2 right-3 space-y-1.5">
                    {[80, 100, 65, 90].map((w, i) => (
                      <div key={i} className="h-1 rounded" style={{ width: `${w}%`, backgroundColor: '#d0e4f8' }} />
                    ))}
                  </div>
                  <div className="absolute left-0 right-0 h-0.5 animate-scan-line"
                    style={{ backgroundColor: '#0B4F6C', boxShadow: '0 0 6px 2px rgba(0,94,184,0.35)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">{loadingStep || 'Starting...'}</p>
                  <p className="text-xs text-blue-600">This takes 30–60 seconds. Please keep this tab open.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── RESULTS ─── */}
      {result && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top bar */}
          <div style={{ backgroundColor: '#072f42' }} className="px-4 py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-blue-200 text-xs">{form.name} (Quick Write)</p>
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
                  onClick={() => downloadAsDoc(result, form.name)}
                  className="text-sm px-3 py-1.5 text-white rounded font-medium cursor-pointer"
                  style={{ backgroundColor: '#0B4F6C' }}>
                  Download .doc
                </button>
                <button
                  onClick={() => { setResult(null); setShowRewrite(false); setRewriteInstruction('') }}
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
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
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
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                          Top
                        </button>
                      </div>
                    </div>
                    <ol className="space-y-1.5 list-none">
                      {result.previousRoleDuties.map((d, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                          <span style={{ color: '#0B4F6C' }} className="flex-shrink-0 font-bold min-w-[1.2rem]">{i + 1}.</span>
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
                              navigator.clipboard.writeText(result.currentRoleDuties.map((d, i) => `${i + 1}. ${d}`).join('\n'))
                              setCopiedDuties(true)
                              setTimeout(() => setCopiedDuties(false), 3000)
                            }}
                            className="text-xs px-2 py-1 bg-gray-800 text-white rounded font-medium hover:bg-gray-700 cursor-pointer">
                            {copiedDuties ? 'Copied!' : 'Copy Duties'}
                          </button>
                          <button
                            onClick={() => statementHeadRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 border border-blue-200">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                            Top
                          </button>
                        </div>
                      )}
                    </div>
                    <ol className="space-y-1.5 list-none">
                      {result.currentRoleDuties.map((d, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                          <span style={{ color: '#0B4F6C' }} className="flex-shrink-0 font-bold min-w-[1.2rem]">{i + 1}.</span>
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
                      <span style={{ color: '#0B4F6C' }}>&#8635;</span>
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
                          style={{ backgroundColor: '#0B4F6C' }}>
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
