'use client'
import { useState, useEffect, useContext, useRef } from 'react'
import { AdminContext } from '@/lib/admin-context'

type PromptEntry = { content: string; isCustom: boolean; updatedAt?: string }
type Prompts = { 'england-wales': PromptEntry; scotland: PromptEntry }

type BannedWordRow = {
  id: string
  word: string
  replacement: string
  pattern_type: 'verb' | 'adjective' | 'noun' | 'phrase' | 'other'
  enabled: boolean
  created_at: string
}

const REGION_LABELS: Record<string, string> = {
  'england-wales': 'England & Wales',
  scotland: 'Scotland',
}

const TYPE_LABELS: Record<string, string> = {
  verb: 'Verb',
  adjective: 'Adjective / Adverb',
  noun: 'Noun',
  phrase: 'Phrase',
  other: 'Other',
}

const TYPE_COLOURS: Record<string, string> = {
  verb:      'bg-blue-50 text-blue-700 border-blue-200',
  adjective: 'bg-purple-50 text-purple-700 border-purple-200',
  noun:      'bg-amber-50 text-amber-700 border-amber-200',
  phrase:    'bg-green-50 text-green-700 border-green-200',
  other:     'bg-gray-100 text-gray-600 border-gray-200',
}

// ── Banned Words Panel ─────────────────────────────────────────────────────────

function BannedWordsPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<BannedWordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [addWord, setAddWord] = useState('')
  const [addReplacement, setAddReplacement] = useState('')
  const [addType, setAddType] = useState<string>('other')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const wordInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/banned-words', { headers: { 'x-admin-token': token } })
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!addWord.trim()) return
    setAdding(true)
    setAddError(null)
    const res = await fetch('/api/admin/banned-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ word: addWord.trim(), replacement: addReplacement.trim(), pattern_type: addType }),
    })
    if (res.ok) {
      setAddWord('')
      setAddReplacement('')
      setAddType('other')
      await load()
      wordInputRef.current?.focus()
    } else {
      const d = await res.json()
      setAddError(d.error || 'Failed to add')
    }
    setAdding(false)
  }

  const handleToggle = async (row: BannedWordRow) => {
    await fetch('/api/admin/banned-words', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ id: row.id, enabled: !row.enabled }),
    })
    setRows(r => r.map(x => x.id === row.id ? { ...x, enabled: !x.enabled } : x))
  }

  const handleDelete = async (id: string, word: string) => {
    if (!confirm(`Remove "${word}" from the banned list?`)) return
    await fetch('/api/admin/banned-words', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ id }),
    })
    setRows(r => r.filter(x => x.id !== id))
  }

  const handleSaveEdit = async (id: string) => {
    await fetch('/api/admin/banned-words', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ id, replacement: editVal }),
    })
    setRows(r => r.map(x => x.id === id ? { ...x, replacement: editVal } : x))
    setEditingId(null)
  }

  const filtered = rows.filter(r => {
    const matchType = typeFilter === 'all' || r.pattern_type === typeFilter
    const matchText = !filter || r.word.includes(filter.toLowerCase()) || r.replacement.toLowerCase().includes(filter.toLowerCase())
    return matchType && matchText
  })

  const enabledCount = rows.filter(r => r.enabled).length

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm font-medium text-blue-900">How it works</p>
        <p className="text-xs text-blue-800 mt-1">
          After every statement is generated, banned words are automatically swapped for their replacement.
          Disabled words are still scanned and flagged in the coverage report, but are not auto-replaced.
          Run <code className="bg-blue-100 px-1 rounded">supabase-migration-banned-words.sql</code> once if this list is empty.
        </p>
        <p className="text-xs text-blue-700 mt-1 font-medium">{enabledCount} of {rows.length} words active</p>
      </div>

      {/* Add new word */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Add banned word</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={wordInputRef}
            value={addWord}
            onChange={e => setAddWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Banned word or phrase"
            className="flex-1 min-w-40 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            value={addReplacement}
            onChange={e => setAddReplacement(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Replacement (leave blank to delete phrase)"
            className="flex-1 min-w-48 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={addType}
            onChange={e => setAddType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none cursor-pointer"
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button
            onClick={handleAdd}
            disabled={adding || !addWord.trim()}
            className="px-4 py-2 text-sm text-white font-semibold rounded-md disabled:opacity-50 cursor-pointer transition-colors"
            style={{ backgroundColor: '#0B4F6C' }}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <p className="text-xs text-red-600">{addError}</p>}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search words…"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex gap-1">
          {['all', 'verb', 'adjective', 'noun', 'phrase', 'other'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border cursor-pointer transition-colors ${
                typeFilter === t
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {t === 'all' ? `All (${rows.length})` : `${TYPE_LABELS[t]} (${rows.filter(r => r.pattern_type === t).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">On</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Banned word</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Replacement</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No results</td></tr>
              )}
              {filtered.map(row => (
                <tr key={row.id} className={`transition-colors ${row.enabled ? '' : 'opacity-40'}`}>
                  {/* Toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(row)}
                      className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative ${row.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={row.enabled ? 'Disable' : 'Enable'}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${row.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </td>
                  {/* Word */}
                  <td className="px-4 py-3 font-mono text-gray-900 font-medium">{row.word}</td>
                  {/* Type */}
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLOURS[row.pattern_type] || TYPE_COLOURS.other}`}>
                      {TYPE_LABELS[row.pattern_type] || row.pattern_type}
                    </span>
                  </td>
                  {/* Replacement — inline edit */}
                  <td className="px-4 py-3">
                    {editingId === row.id ? (
                      <div className="flex gap-1 items-center">
                        <input
                          autoFocus
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(row.id); if (e.key === 'Escape') setEditingId(null) }}
                          className="border border-blue-400 rounded px-2 py-1 text-xs focus:outline-none w-40"
                        />
                        <button onClick={() => handleSaveEdit(row.id)} className="text-xs text-green-700 font-semibold cursor-pointer hover:underline">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 cursor-pointer hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(row.id); setEditVal(row.replacement) }}
                        className="text-gray-600 hover:text-blue-600 cursor-pointer text-left group"
                        title="Click to edit replacement"
                      >
                        {row.replacement
                          ? <span className="font-mono">{row.replacement}</span>
                          : <span className="text-gray-300 italic text-xs">(delete phrase)</span>
                        }
                        <span className="ml-1 text-gray-300 group-hover:text-blue-400 text-xs">✎</span>
                      </button>
                    )}
                  </td>
                  {/* Delete */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(row.id, row.word)}
                      className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
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
            style={{ backgroundColor: isDirty ? '#0B4F6C' : '#9ca3af' }}
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
  const [activeTab, setActiveTab] = useState<'england-wales' | 'scotland' | 'banned-words'>('england-wales')

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
          <div className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#0B4F6C' }} />
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

      {/* Tabs */}
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
        <button
          onClick={() => setActiveTab('banned-words')}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-md cursor-pointer transition-colors ${
            activeTab === 'banned-words'
              ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Banned Words
        </button>
      </div>

      {/* Active panel */}
      {activeTab === 'banned-words' ? (
        <BannedWordsPanel token={token} />
      ) : (
        <PromptEditor
          key={activeTab}
          region={activeTab}
          entry={prompts[activeTab]}
          token={token}
          onSaved={load}
        />
      )}
    </div>
  )
}
