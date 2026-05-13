'use client'
import { useState } from 'react'
import { useAdminToken } from '@/lib/admin-context'
import { FileDropZone } from '@/components/FileDropZone'

const FIELD_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical'

export default function QuickWritePage() {
  const { token } = useAdminToken()

  const [form, setForm] = useState({
    name: '',
    work_history: '',
    qualifications: '',
    skills: '',
    background: '',
    vacancy_url: '',
    person_spec: '',
    instructions: '',
    style: '1',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    statement: string
    jobTitle: string
    organisation: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/quick-write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error, please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result.statement)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setResult(null)
    setError('')
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Quick Statement Writer</h1>
        <p className="text-sm text-gray-500 mt-1">
          One-time use: paste a candidate&apos;s background and job link to generate a supporting statement instantly. Nothing is saved.
        </p>
      </div>

      {result ? (
        <div className="space-y-4">
          {/* Result header */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-green-800">Statement generated</p>
              <p className="text-xs text-green-700 mt-0.5">
                {result.jobTitle}: {result.organisation}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-medium rounded border border-green-600 text-green-700 hover:bg-green-100 cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                New statement
              </button>
            </div>
          </div>

          {/* Statement text */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">
              {result.statement}
            </pre>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-gray-200 p-6">
          {/* Row: Name + Job URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Candidate name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                required
                placeholder="e.g. Jane Smith"
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Job advert URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={form.vacancy_url}
                onChange={set('vacancy_url')}
                required
                placeholder="https://www.jobs.nhs.uk/..."
                className={FIELD_CLASS}
              />
            </div>
          </div>

          {/* Work history */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Work history
            </label>
            <textarea
              value={form.work_history}
              onChange={set('work_history')}
              rows={5}
              placeholder="Paste their CV / work history here: job titles, employers, dates, key duties..."
              className={FIELD_CLASS}
            />
          </div>

          {/* Qualifications + Skills side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Qualifications
              </label>
              <textarea
                value={form.qualifications}
                onChange={set('qualifications')}
                rows={4}
                placeholder="Degrees, diplomas, GCSEs, NVQs, Care certificates..."
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Skills
              </label>
              <textarea
                value={form.skills}
                onChange={set('skills')}
                rows={4}
                placeholder="IT systems, clinical skills, languages, soft skills..."
                className={FIELD_CLASS}
              />
            </div>
          </div>

          {/* Background */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Additional background
            </label>
            <textarea
              value={form.background}
              onChange={set('background')}
              rows={3}
              placeholder="Anything else relevant: immigration status, gaps, special context..."
              className={FIELD_CLASS}
            />
          </div>

          {/* Person Spec upload/paste */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Person Specification <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <FileDropZone onText={(text) => setForm(f => ({ ...f, person_spec: text }))} disabled={loading} />
            <textarea
              value={form.person_spec}
              onChange={set('person_spec')}
              rows={4}
              placeholder="Or paste the person spec criteria here..."
              className={`${FIELD_CLASS} mt-2`}
              disabled={loading}
            />
          </div>

          {/* Instructions + Style */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Special instructions <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={form.instructions}
                onChange={set('instructions')}
                rows={2}
                placeholder="e.g. Emphasise Band 3 experience. Don't mention previous employer name."
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Style
              </label>
              <select
                value={form.style}
                onChange={set('style')}
                className={FIELD_CLASS}
              >
                <option value="1">Style 1 - Subheadings</option>
                <option value="2">Style 2 - Continuous prose</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white rounded-md cursor-pointer disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: loading ? '#64748b' : '#005eb8' }}
            >
              {loading ? 'Generating statement, this takes up to 45 seconds...' : 'Generate Statement'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
