'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface Result {
  statement: string
  duties: string[]
  jobTitle: string
  organisation: string
}

function GeneratePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clientCode = searchParams.get('code') || ''

  const [vacancyUrl, setVacancyUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!clientCode) router.push('/')
  }, [clientCode, router])

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

    try {
      // Simulate step messages
      const stepTimer = setTimeout(() => setLoadingStep('Downloading job description and person specification...'), 4000)
      const stepTimer2 = setTimeout(() => setLoadingStep('Writing your supporting statement...'), 10000)

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_code: clientCode,
          vacancy_url: vacancyUrl.trim(),
          instructions: instructions.trim() || undefined,
        }),
      })

      clearTimeout(stepTimer)
      clearTimeout(stepTimer2)

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setResult(data)
        setLoadingStep('')
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    const text = `SUPPORTING STATEMENT\n${result.jobTitle} — ${result.organisation}\n\n${result.statement}\n\nKEY DUTIES\n${result.duties.map((d) => `• ${d}`).join('\n')}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleDownload = () => {
    if (!result) return
    const text = `SUPPORTING STATEMENT\n${result.jobTitle} — ${result.organisation}\n\n${result.statement}\n\nKEY DUTIES AND RESPONSIBILITIES\n${result.duties.map((d) => `• ${d}`).join('\n')}`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `supporting-statement-${result.jobTitle.replace(/\s+/g, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ backgroundColor: '#003087' }} className="py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
      <div style={{ backgroundColor: '#005eb8' }} className="h-2" />

      <div className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        {/* Input form */}
        {!result && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Generate Your Statement</h2>
            <p className="text-gray-600 mb-6">
              Paste the full link to the NHS or Civil Service job advert below.
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Instructions <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Focus on my community nursing experience, keep it under 600 words..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm resize-none"
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
                className="w-full py-3 px-6 text-white font-semibold rounded-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: loading ? '#999' : '#005eb8' }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#003087' }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#005eb8' }}
              >
                {loading ? 'Generating...' : 'Generate Statement'}
              </button>
            </form>

            {/* Loading state */}
            {loading && (
              <div className="mt-6 flex items-center gap-3 text-gray-600">
                <div
                  className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"
                  style={{ borderTopColor: '#005eb8' }}
                />
                <span className="text-sm">{loadingStep}</span>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6">
            {/* Job info banner */}
            <div style={{ backgroundColor: '#003087' }} className="rounded-lg p-4 text-white">
              <p className="text-sm opacity-75">Statement generated for</p>
              <h2 className="text-xl font-bold">{result.jobTitle}</h2>
              {result.organisation && (
                <p className="text-sm opacity-90 mt-1">{result.organisation}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-2 px-4 text-white rounded-md text-sm font-medium cursor-pointer"
                style={{ backgroundColor: '#005eb8' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#003087')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#005eb8')}
              >
                Download as .txt
              </button>
              <button
                onClick={() => setResult(null)}
                className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
              >
                New Statement
              </button>
            </div>

            {/* Supporting Statement */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                Supporting Statement
              </h3>
              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">
                {result.statement}
              </div>
            </div>

            {/* Key Duties */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                Key Duties &amp; Responsibilities
              </h3>
              <ul className="space-y-2">
                {result.duties.map((duty, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-800">
                    <span style={{ color: '#005eb8' }} className="mt-0.5 flex-shrink-0">
                      •
                    </span>
                    <span>{duty}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-200">
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
