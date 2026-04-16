'use client'
import { useState } from 'react'
import { useAdminToken } from '@/lib/admin-context'

function downloadAsWord(content: string, clientName: string) {
  // Convert plain text / markdown-lite to HTML for Word
  const lines = content.split('\n')
  let html = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      html += '<p>&nbsp;</p>'
      continue
    }

    // Section headers: SECTION 1: ... or lines in all caps with colon
    if (/^SECTION\s+\d+:/i.test(trimmed)) {
      const text = trimmed.replace(/\*\*/g, '')
      html += `<h1 style="color:#003087;font-size:14pt;margin-top:20pt;border-bottom:2px solid #005eb8;padding-bottom:4pt;">${text}</h1>`
      continue
    }

    // Q1–Q20 headers
    if (/^Q\d+[:\s]/i.test(trimmed)) {
      const text = trimmed.replace(/\*\*/g, '')
      html += `<h2 style="color:#005eb8;font-size:12pt;margin-top:14pt;">${text}</h2>`
      continue
    }

    // Part 1 / Part 2 / Part 3
    if (/^Part\s+\d+/i.test(trimmed)) {
      const text = trimmed.replace(/\*\*/g, '')
      html += `<h3 style="color:#003087;font-size:11pt;margin-top:10pt;">${text}</h3>`
      continue
    }

    // Bold labels (PS Criteria Tested:, Hint:, Answer:, Key strengths:, etc.)
    if (/^(PS Criteria Tested|Hint|Answer|Key Strengths|Clinical Phrases|Smart Questions|Other Requirements|Essential|Desirable):/i.test(trimmed)) {
      const text = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      html += `<p><strong>${text}</strong></p>`
      continue
    }

    // Regular paragraph — convert inline **bold**
    const text = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html += `<p style="margin-bottom:6pt;">${text}</p>`
  }

  const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Interview Prep — ${clientName}</title>
<style>
body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; margin: 2cm; color: #111; }
h1 { font-size: 14pt; color: #003087; }
h2 { font-size: 12pt; color: #005eb8; }
h3 { font-size: 11pt; color: #003087; }
p { margin: 0 0 8pt 0; }
</style>
</head>
<body>
<h1 style="font-size:18pt;color:#003087;border-bottom:3px solid #003087;padding-bottom:6pt;">
  NHS Interview Preparation — ${clientName}
</h1>
${html}
</body>
</html>`

  const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${clientName.replace(/\s+/g, '-').toLowerCase()}-interview-prep.doc`
  a.click()
  URL.revokeObjectURL(url)
}

export default function InterviewPrepPage() {
  const { token } = useAdminToken()

  const [clientCode, setClientCode] = useState('')
  const [jobAdvert, setJobAdvert] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [personSpec, setPersonSpec] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ content: string; clientName: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientCode.trim()) { setError('Enter a client code'); return }
    if (!jobDescription.trim()) { setError('Paste the job description'); return }
    if (!personSpec.trim()) { setError('Paste the person specification'); return }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/admin/interview-prep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({
          client_code: clientCode.trim(),
          job_advert: jobAdvert.trim() || undefined,
          job_description: jobDescription.trim(),
          person_spec: personSpec.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError('')
    setClientCode('')
    setJobAdvert('')
    setJobDescription('')
    setPersonSpec('')
  }

  if (result) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Interview Prep Ready</h2>
              <p className="text-sm text-gray-500 mt-0.5">{result.clientName}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                New Prep
              </button>
              <button
                onClick={() => downloadAsWord(result.content, result.clientName)}
                className="px-5 py-2 text-sm font-semibold text-white rounded-md cursor-pointer"
                style={{ backgroundColor: '#005eb8' }}
              >
                Download Word Doc
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-5 text-sm text-gray-700 leading-relaxed max-h-[600px] overflow-y-auto whitespace-pre-wrap font-mono">
            {result.content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Interview Prep Generator</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter the applicant code and paste the job documents to generate a full interview preparation pack.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Client code */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
            Client Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value.toUpperCase())}
            placeholder="e.g. NHSAB1234"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Job Advert */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            Job Advert Text{' '}
            <span className="font-normal text-gray-400">(optional — paste from the job listing page)</span>
          </label>
          <textarea
            value={jobAdvert}
            onChange={(e) => setJobAdvert(e.target.value)}
            placeholder="Paste the job advert introduction here..."
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
          />
        </div>

        {/* Job Description */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            Job Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here (duties, responsibilities, etc.)..."
            rows={8}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
          />
        </div>

        {/* Person Specification */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            Person Specification <span className="text-red-500">*</span>
          </label>
          <textarea
            value={personSpec}
            onChange={(e) => setPersonSpec(e.target.value)}
            placeholder="Paste the full person specification here (essential & desirable criteria)..."
            rows={8}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 text-white font-semibold rounded-md cursor-pointer disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
          style={{ backgroundColor: '#005eb8' }}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating interview prep... (up to 60 seconds)
            </>
          ) : (
            'Generate Interview Prep'
          )}
        </button>
      </form>
    </div>
  )
}
