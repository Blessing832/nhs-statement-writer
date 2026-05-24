'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAdminToken } from '@/lib/admin-context'
import type { Client } from '@/lib/types'

interface ClientRow {
  client: Client
  instructions: string
  dirty: boolean
  saving: boolean
  drafting: boolean
  saved: boolean
  error: string
}

function profileSummary(c: Client): string {
  const parts: string[] = []
  if (c.work_history) parts.push(c.work_history.slice(0, 120).replace(/\n/g, ' '))
  if (c.qualifications) parts.push(c.qualifications.slice(0, 80).replace(/\n/g, ' '))
  return parts.join(' · ') || 'No profile yet'
}

export default function BulkInstructionsPage() {
  const { token } = useAdminToken()
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [draftingAll, setDraftingAll] = useState(false)
  const [draftAllProgress, setDraftAllProgress] = useState(0)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/clients', { headers: { 'x-admin-token': token } })
    if (res.ok) {
      const clients: Client[] = await res.json()
      setRows(clients.map(c => ({
        client: c,
        instructions: c.special_instructions || '',
        dirty: false,
        saving: false,
        drafting: false,
        saved: false,
        error: '',
      })))
    }
    setLoading(false)
  }, [token])

  useEffect(() => { fetchClients() }, [fetchClients])

  const updateRow = (id: string, patch: Partial<ClientRow>) =>
    setRows(prev => prev.map(r => r.client.id === id ? { ...r, ...patch } : r))

  const handleChange = (id: string, value: string) =>
    updateRow(id, { instructions: value, dirty: true, saved: false, error: '' })

  const handleSave = async (row: ClientRow) => {
    updateRow(row.client.id, { saving: true, error: '' })
    try {
      const res = await fetch(`/api/clients/${row.client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({
          full_name: row.client.full_name,
          work_history: row.client.work_history,
          qualifications: row.client.qualifications,
          skills: row.client.skills,
          background: row.client.background,
          special_instructions: row.instructions,
          subscription_end: row.client.subscription_end,
          is_active: row.client.is_active,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      updateRow(row.client.id, { saving: false, dirty: false, saved: true })
      setTimeout(() => updateRow(row.client.id, { saved: false }), 3000)
    } catch {
      updateRow(row.client.id, { saving: false, error: 'Save failed, try again' })
    }
  }

  const handleDraft = async (row: ClientRow) => {
    updateRow(row.client.id, { drafting: true, error: '' })
    try {
      const res = await fetch('/api/admin/draft-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({
          full_name: row.client.full_name,
          work_history: row.client.work_history,
          qualifications: row.client.qualifications,
          skills: row.client.skills,
          background: row.client.background,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Draft failed')
      updateRow(row.client.id, { drafting: false, instructions: data.draft, dirty: true })
    } catch (err) {
      updateRow(row.client.id, { drafting: false, error: err instanceof Error ? err.message : 'Draft failed' })
    }
  }

  const handleDraftAll = async () => {
    const todo = rows.filter(r => !r.instructions.trim())
    if (todo.length === 0) {
      alert('All candidates already have instructions. To re-draft someone, clear their instructions first.')
      return
    }
    if (!confirm(`Draft instructions for ${todo.length} candidates with no instructions yet? This will take about ${Math.ceil(todo.length * 5 / 60)} minutes.`)) return

    setDraftingAll(true)
    setDraftAllProgress(0)
    for (let i = 0; i < todo.length; i++) {
      await handleDraft(todo[i])
      setDraftAllProgress(i + 1)
      // Small delay to avoid rate limiting
      if (i < todo.length - 1) await new Promise(r => setTimeout(r, 800))
    }
    setDraftingAll(false)
  }

  const handleSaveAll = async () => {
    const dirty = rows.filter(r => r.dirty)
    for (const row of dirty) {
      await handleSave(row)
    }
  }

  const filtered = rows.filter(r =>
    r.client.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.client.client_code.toLowerCase().includes(search.toLowerCase())
  )

  const dirtyCount = rows.filter(r => r.dirty).length
  const emptyCount = rows.filter(r => !r.instructions.trim()).length

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center text-gray-400">
        Loading candidates...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Bulk Instructions Editor</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set unique writing instructions for each candidate. Claude uses these on every statement generated for them.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {rows.length} candidates
          </span>
          {emptyCount > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded">
              {emptyCount} with no instructions
            </span>
          )}
          {dirtyCount > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded">
              {dirtyCount} unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {dirtyCount > 0 && (
          <button
            onClick={handleSaveAll}
            className="px-4 py-2 text-sm font-semibold text-white rounded-md cursor-pointer"
            style={{ backgroundColor: '#009639' }}
          >
            Save All ({dirtyCount})
          </button>
        )}
        {emptyCount > 0 && (
          <button
            onClick={handleDraftAll}
            disabled={draftingAll}
            className="px-4 py-2 text-sm font-semibold text-white rounded-md cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: '#005eb8' }}
          >
            {draftingAll
              ? `Drafting... ${draftAllProgress}/${rows.filter(r => !r.instructions.trim()).length}`
              : `Auto-Draft Missing (${emptyCount})`}
          </button>
        )}
      </div>

      {/* Candidate list */}
      <div className="space-y-4">
        {filtered.map(row => {
          const expired = new Date() > new Date(row.client.subscription_end)
          const isActive = row.client.is_active && !expired

          return (
            <div
              key={row.client.id}
              className={`bg-white rounded-xl border p-5 transition-all ${row.dirty ? 'border-blue-300' : 'border-gray-200'}`}
            >
              {/* Name + status */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm">{row.client.full_name}</h3>
                    <span className="font-mono text-xs text-gray-400">{row.client.client_code}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {isActive ? 'Active' : expired ? 'Expired' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{profileSummary(row.client)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDraft(row)}
                    disabled={row.drafting || row.saving}
                    title="Auto-generate instructions from this candidate's profile"
                    className="px-3 py-1.5 text-xs font-medium border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 cursor-pointer disabled:opacity-50"
                  >
                    {row.drafting ? 'Drafting...' : row.instructions.trim() ? 'Re-draft' : 'Draft'}
                  </button>
                  <button
                    onClick={() => handleSave(row)}
                    disabled={!row.dirty || row.saving}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-md cursor-pointer disabled:opacity-40"
                    style={{ backgroundColor: row.dirty ? '#005eb8' : '#9ca3af' }}
                  >
                    {row.saving ? 'Saving...' : row.saved ? 'Saved ✓' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Instructions textarea */}
              <textarea
                value={row.instructions}
                onChange={e => handleChange(row.client.id, e.target.value)}
                placeholder="No instructions yet. Click Draft to auto-generate from this candidate's profile, or type manually..."
                rows={row.instructions ? Math.max(4, row.instructions.split('\n').length + 1) : 3}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-700 leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none bg-gray-50"
              />

              {row.error && (
                <p className="text-xs text-red-600 mt-1">{row.error}</p>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">No candidates match your search.</p>
        )}
      </div>
    </div>
  )
}
