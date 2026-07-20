'use client'
import { useState, useEffect, useContext } from 'react'
import { AdminContext } from '@/lib/admin-context'

type PromptEntry = { content: string; isCustom: boolean; updatedAt?: string }
type Prompts = { 'england-wales': PromptEntry; scotland: PromptEntry }

const REGION_LABELS: Record<string, string> = {
  'england-wales': 'England & Wales',
  scotland: 'Scotland',
}

function WordCount({ text }: { text: string }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars = text.length
  return (
    <span className="text-xs text-gray-400">
      {words.toLocaleString()} words · {chars.toLocaleString()} characters
    </span>
  )
}

function PromptEditor({
  region,
  entry,
  token,
  onSaved,
}: {
  region: string
  entry: PromptEntry
  token: string
  onSaved: () => void
}) {
  const [text, setText] = useState(entry.content)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Keep text in sync if parent data refreshes
  useEffect(() => {
    setText(entry.content)
  }, [entry.content])

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ region, content: text }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus({ type: 'success', message: 'Prompt saved. All future statements will use this prompt.' })
        onSaved()
      } else {
        setStatus({ type: 'error', message: data.error || 'Save failed' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error — please try again' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm(`Reset the ${REGION_LABELS[region]} prompt back to the built-in default? This cannot be undone.`)) return
    setResetting(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ region }),
      })
      if (res.ok) {
        setStatus({ type: 'success', message: 'Reset to built-in default.' })
        onSaved()
      } else {
        const data = await res.json()
        setStatus({ type: 'error', message: data.error || 'Reset failed' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error — please try again' })
    } finally {
      setResetting(false)
    }
  }

  const isDirty = text !== entry.content

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{REGION_LABELS[region]} Prompt</h2>
          <div className="flex items-center gap-3 mt-0.5">
            {entry.isCustom ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                ● Custom (your version)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                ○ Built-in default
              </span>
            )}
            {entry.updatedAt && (
              <span className="text-xs text-gray-400">
                Last saved {new Date(entry.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
            <WordCount text={text} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {entry.isCustom && (
            <button
              onClick={handleReset}
              disabled={resetting || saving}
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {resetting ? 'Resetting…' : 'Reset to default'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || resetting || !isDirty}
            className="px-4 py-1.5 text-xs text-white font-semibold rounded-md cursor-pointer disabled:opacity-50 transition-colors"
            style={{ backgroundColor: isDirty ? '#005eb8' : '#9ca3af' }}
          >
            {saving ? 'Saving…' : isDirty ? 'Save prompt' : 'No changes'}
          </button>
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div className={`px-5 py-2 text-sm font-medium ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {status.message}
        </div>
      )}

      {/* Textarea — no height limit, grows with content */}
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus(null) }}
        className="w-full p-5 text-sm font-mono text-gray-800 leading-relaxed resize-none focus:outline-none"
        style={{ minHeight: '70vh' }}
        placeholder={`Enter the full ${REGION_LABELS[region]} system prompt here…`}
        spellCheck={false}
      />
    </div>
  )
}

export default function PromptsPage() {
  const { token } = useContext(AdminContext)
  const [prompts, setPrompts] = useState<Prompts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'england-wales' | 'scotland'>('england-wales')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/prompts')
      if (!res.ok) throw new Error('Failed to load prompts')
      const data = await res.json()
      setPrompts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#005eb8' }} />
          <span className="text-sm">Loading prompts…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700 font-medium">{error}</p>
          {error.includes('table does not exist') && (
            <div className="mt-4">
              <p className="text-sm text-red-600 mb-2">Run this SQL in your Supabase SQL editor first:</p>
              <pre className="bg-red-100 rounded p-3 text-xs text-red-800 overflow-x-auto">{`CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  region TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
            </div>
          )}
          <button onClick={load} className="mt-3 text-sm text-red-700 underline cursor-pointer">Try again</button>
        </div>
      </div>
    )
  }

  if (!prompts) return null

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prompt Editor</h1>
        <p className="text-sm text-gray-500 mt-1">
          Edit the system prompts used to generate statements. What you save here is used for every statement — no word count limit.
          To go back to the built-in prompt, click "Reset to default".
        </p>
      </div>

      {/* SQL migration notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-800">First-time setup</p>
        <p className="text-xs text-amber-700 mt-1">
          You need a <code className="bg-amber-100 px-1 rounded">prompts</code> table in Supabase. Run this once in your SQL editor if you have not already:
        </p>
        <pre className="mt-2 bg-amber-100 rounded p-2 text-xs text-amber-900 overflow-x-auto">{`CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  region TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
      </div>

      {/* Region tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['england-wales', 'scotland'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setActiveTab(r)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-md cursor-pointer transition-colors ${
              activeTab === r
                ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {REGION_LABELS[r]}
            {prompts[r].isCustom && (
              <span className="ml-2 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Custom prompt active" />
            )}
          </button>
        ))}
      </div>

      {/* Active editor */}
      <PromptEditor
        key={activeTab}
        region={activeTab}
        entry={prompts[activeTab]}
        token={token}
        onSaved={load}
      />
    </div>
  )
}
