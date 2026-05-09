'use client'
import { useState } from 'react'
import { useAdminToken } from '@/lib/admin-context'

function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-gray-900">{part}</strong> : part
  )
}

function RenderContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const t = raw.trim()

    if (!t) { nodes.push(<div key={i} className="h-3" />); continue }
    if (t === '---') { nodes.push(<hr key={i} className="border-blue-100 my-5" />); continue }

    if (/^SECTION\s+\d+:/i.test(t)) {
      const text = t.replace(/\*\*/g, '')
      nodes.push(
        <h2 key={i} className="text-base font-bold uppercase tracking-wide mt-10 mb-3 pb-2 border-b-2"
          style={{ color: '#003087', borderColor: '#005eb8' }}>
          {text}
        </h2>
      )
      continue
    }

    if (/^Q\d+\s+to\s+Q\d+:/i.test(t)) {
      nodes.push(
        <p key={i} className="text-xs font-bold uppercase tracking-widest mt-6 mb-2" style={{ color: '#005eb8' }}>
          {t.replace(/\*\*/g, '')}
        </p>
      )
      continue
    }

    if (/^Q\d+[:\s]/i.test(t)) {
      nodes.push(
        <h3 key={i} className="font-semibold text-sm mt-6 mb-1.5 leading-snug" style={{ color: '#003087' }}>
          {parseBold(t)}
        </h3>
      )
      continue
    }

    if (/^Part\s+\d+/i.test(t)) {
      nodes.push(
        <h3 key={i} className="font-semibold mt-5 mb-1.5" style={{ color: '#003087' }}>
          {t.replace(/\*\*/g, '')}
        </h3>
      )
      continue
    }

    const labelMatch = t.match(/^\*\*(PS Criteria Tested|Hint|Answer|Key Strengths|Clinical Phrases|Smart Questions to Ask the Panel|Essential Qualifications[^:]*|Essential Experience[^:]*|Essential Skills[^:]*|Desirable[^:]*|Other Requirements[^:]*)\*\*:(.*)/)
    const plainLabelMatch = !labelMatch && t.match(/^(PS Criteria Tested|Hint|Answer|Key Strengths|Clinical Phrases|Smart Questions to Ask the Panel|Essential Qualifications[^:]*|Essential Experience[^:]*|Essential Skills[^:]*|Desirable[^:]*|Other Requirements[^:]*):(.*)/)
    const match = labelMatch || plainLabelMatch

    if (match) {
      const label = match[1]
      const rest = match[2].trim()
      const isAnswer = /^answer$/i.test(label)
      const isHint = /^hint$/i.test(label)
      nodes.push(
        <div key={i} className={`mt-3 ${isAnswer ? 'bg-blue-50 rounded-lg p-4 border border-blue-100' : isHint ? 'bg-amber-50 rounded-lg p-3 border border-amber-100' : ''}`}>
          <span className={`font-semibold text-sm ${isAnswer ? 'text-blue-800' : isHint ? 'text-amber-800' : 'text-gray-800'}`}>{label}: </span>
          {rest && <span className="text-gray-700 text-sm">{parseBold(rest)}</span>}
        </div>
      )
      continue
    }

    if (/^[-•]\s/.test(t)) {
      nodes.push(
        <li key={i} className="ml-5 text-sm text-gray-700 leading-relaxed list-disc">
          {parseBold(t.slice(2))}
        </li>
      )
      continue
    }

    nodes.push(
      <p key={i} className="text-sm text-gray-700 leading-relaxed">
        {parseBold(t)}
      </p>
    )
  }

  return <div className="space-y-0.5">{nodes}</div>
}

function downloadAsWord(content: string, clientName: string) {
  const lines = content.split('\n')
  let html = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      html += '<p>&nbsp;</p>'
      continue
    }

    if (/^SECTION\s+\d+:/i.test(trimmed)) {
      const text = trimmed.replace(/\*\*/g, '')
      html += `<h1 style="color:#003087;font-size:14pt;margin-top:20pt;border-bottom:2px solid #005eb8;padding-bottom:4pt;">${text}</h1>`
      continue
    }

    if (/^Q\d+[:\s]/i.test(trimmed)) {
      const text = trimmed.replace(/\*\*/g, '')
      html += `<h2 style="color:#005eb8;font-size:12pt;margin-top:14pt;">${text}</h2>`
      continue
    }

    if (/^Part\s+\d+/i.test(trimmed)) {
      const text = trimmed.replace(/\*\*/g, '')
      html += `<h3 style="color:#003087;font-size:11pt;margin-top:10pt;">${text}</h3>`
      continue
    }

    if (/^(PS Criteria Tested|Hint|Answer|Key Strengths|Clinical Phrases|Smart Questions|Other Requirements|Essential|Desirable):/i.test(trimmed)) {
      const text = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      html += `<p><strong>${text}</strong></p>`
      continue
    }

    const text = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html += `<p style="margin-bottom:6pt;">${text}</p>`
  }

  const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Interview Prep - ${clientName}</title>
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
  NHS Interview Preparation - ${clientName}
</h1>
${html}
</body>
</html>`

  const blob = new Blob(['﻿', fullHtml], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${clientName.replace(/\s+/g, '-').toLowerCase()}-interview-prep.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function InterviewPrepPage() {
  const { token } = useAdminToken()

  const [clientCode, setClientCode] = useState('')
  const [jdAndPs, setJdAndPs] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ content: string; clientName: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientCode.trim()) { setError('Enter a client code'); return }
    if (!jdAndPs.trim()) { setError('Paste the job description and person specification'); return }

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
          jd_and_ps: jdAndPs.trim(),
        }),
      })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('The server took too long to respond. Please try again — interview prep can take up to 2 minutes.')
      }
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
    setJdAndPs('')
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

          <div className="bg-white rounded-lg p-6 max-h-[700px] overflow-y-auto border border-gray-100">
            <RenderContent content={result.content} />
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
          Enter the applicant code and paste the full job description and person specification to generate a complete interview preparation pack.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            Job Description and Person Specification <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Paste the full text — job description, duties, and person specification together. Select all text on the job page (Ctrl+A then Ctrl+C) and paste here.
          </p>
          <textarea
            value={jdAndPs}
            onChange={(e) => setJdAndPs(e.target.value)}
            placeholder="Paste the full job description and person specification here..."
            rows={16}
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
              Generating interview prep... (up to 2 minutes)
            </>
          ) : (
            'Generate Interview Prep Pack'
          )}
        </button>
      </form>
    </div>
  )
}
