'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAdminToken } from '@/lib/admin-context'
import type { ApplicantPreferences, SearchLink } from '@/lib/vacancy/types'
import type { Client } from '@/lib/types'

// ── Search Links Manager ──────────────────────────────────────────────────────
function SearchLinksManager({
  links,
  onChange,
}: {
  links: SearchLink[]
  onChange: (v: SearchLink[]) => void
}) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')

  const add = () => {
    if (!label.trim()) { setErr('Enter a label'); return }
    if (!url.trim() || !url.startsWith('http')) { setErr('Enter a valid URL'); return }
    const newLink: SearchLink = { id: crypto.randomUUID(), label: label.trim(), url: url.trim() }
    onChange([...links, newLink])
    setLabel('')
    setUrl('')
    setErr('')
  }

  const remove = (id: string) => onChange(links.filter(l => l.id !== id))

  function guessBoard(u: string) {
    if (u.includes('jobs.nhs.uk'))    return 'NHS Jobs'
    if (u.includes('healthjobsuk'))   return 'HealthJobsUK'
    if (u.includes('jobs.scot'))      return 'NHS Scotland'
    if (u.includes('civilservice'))   return 'Civil Service'
    return 'Job Board'
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Search Links</label>
        <p className="text-xs text-gray-500 mb-3">
          Go to the job board, set all your filters (location, band, role, contract type), then copy the URL and paste it here with a short label.
          One person can have as many links as needed.
        </p>
      </div>

      {/* Existing links */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map(link => (
            <div key={link.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{link.label}</p>
                <p className="text-xs text-gray-400 truncate">{guessBoard(link.url)} · {link.url}</p>
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline shrink-0"
              >
                Test ↗
              </a>
              <button
                type="button"
                onClick={() => remove(link.id)}
                className="text-xs text-red-500 hover:text-red-700 shrink-0 cursor-pointer"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new link */}
      <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-gray-600">Add a new search link</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => { setLabel(e.target.value); setErr('') }}
              placeholder="e.g. London Band 3 NHS Jobs"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setErr('') }}
              placeholder="https://www.jobs.nhs.uk/candidate/search/results?..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button
          type="button"
          onClick={add}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg cursor-pointer"
          style={{ backgroundColor: '#009639' }}
        >
          + Add Link
        </button>
      </div>
    </div>
  )
}

// ── Tag Input ─────────────────────────────────────────────────────────────────
function TagInput({ label, values, onChange, placeholder, hint }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; hint?: string
}) {
  const [input, setInput] = useState('')
  const add = (val: string) => {
    const t = val.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setInput('')
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-md min-h-[44px] focus-within:ring-2 focus-within:ring-blue-500 bg-white">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="text-blue-600 hover:text-blue-900 cursor-pointer">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) }
            if (e.key === 'Backspace' && !input && values.length > 0) onChange(values.slice(0, -1))
          }}
          onBlur={() => { if (input.trim()) add(input) }}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm text-gray-700 bg-transparent"
        />
      </div>
    </div>
  )
}

// ── Preference Form ───────────────────────────────────────────────────────────
function PreferenceForm({ clients, existing, token, onSaved, onCancel }: {
  clients: Client[]; existing?: ApplicantPreferences | null; token: string; onSaved: () => void; onCancel: () => void
}) {
  const [clientId, setClientId]       = useState(existing?.client_id || '')
  const [roleKeywords, setRoleKeywords] = useState<string[]>(existing?.role_keywords || [])
  const [notes, setNotes]             = useState(existing?.notes || '')
  const [searchLinks, setSearchLinks] = useState<SearchLink[]>(existing?.search_links || [])
  const [isActive, setIsActive]       = useState(existing?.is_active ?? true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) { setError('Please select an applicant'); return }

    setSaving(true)
    setError('')
    const res = await fetch('/api/vacancies/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({
        client_id: clientId,
        role_keywords: roleKeywords,
        notes,
        search_links: searchLinks,
        is_active: isActive,
        locations: existing?.locations || [],
        bands: existing?.bands || [],
        sources: existing?.sources || ['england', 'healthjobsuk'],
        employment_type: existing?.employment_type || 'any',
      }),
    })
    setSaving(false)
    if (res.ok) onSaved()
    else { const d = await res.json(); setError(d.error || 'Failed to save') }
  }

  const availableClients = existing ? clients : clients.filter(c => c.is_active)

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Applicant selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Applicant</label>
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          disabled={!!existing}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
        >
          <option value="">— Select applicant —</option>
          {availableClients.map(c => (
            <option key={c.id} value={c.id}>{c.full_name} ({c.client_code})</option>
          ))}
        </select>
      </div>

      {/* Search Links — primary feature */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
        <SearchLinksManager links={searchLinks} onChange={setSearchLinks} />
      </div>

      {/* Role keywords — for reference */}
      <TagInput
        label="Role Keywords (for reference)"
        values={roleKeywords}
        onChange={setRoleKeywords}
        placeholder="e.g. Support Worker, Healthcare Assistant..."
        hint="Just for your reference — not used for scraping anymore."
      />

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Any notes about this applicant..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setIsActive(v => !v)}
          className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isActive ? 'left-5' : 'left-0.5'}`} />
        </div>
        <span className="text-sm text-gray-700">Active monitoring</span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg cursor-pointer disabled:opacity-60"
          style={{ backgroundColor: '#0B4F6C' }}
        >
          {saving ? 'Saving...' : existing ? 'Update' : 'Add Applicant'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PreferencesPage() {
  const { token } = useAdminToken()
  const [clients, setClients] = useState<Client[]>([])
  const [prefs, setPrefs] = useState<ApplicantPreferences[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ApplicantPreferences | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch('/api/clients', { headers: { 'x-admin-token': token } }),
      fetch('/api/vacancies/preferences', { headers: { 'x-admin-token': token } }),
    ])
    if (cRes.ok) setClients(await cRes.json())
    if (pRes.ok) setPrefs(await pRes.json())
    setLoading(false)
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaved = () => { setShowForm(false); setEditing(null); fetchData() }

  const handleDelete = async (pref: ApplicantPreferences) => {
    if (!confirm(`Remove ${pref.client?.full_name ?? 'this applicant'}?`)) return
    setDeleting(pref.client_id)
    await fetch(`/api/vacancies/preferences?client_id=${pref.client_id}`, {
      method: 'DELETE', headers: { 'x-admin-token': token },
    })
    setPrefs(prev => prev.filter(p => p.client_id !== pref.client_id))
    setDeleting(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#0B4F6C' }} />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8">
      <div className="mb-5">
        <Link href="/admin/vacancies" className="text-sm text-blue-700 hover:underline">← Back to Vacancy Links</Link>
      </div>

      {/* Form panel */}
      {(showForm || editing) ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-5">
            {editing ? `Edit: ${editing.client?.full_name}` : 'Add Applicant'}
          </h2>
          <PreferenceForm
            clients={clients}
            existing={editing}
            token={token}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </div>
      ) : (
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Applicant Preferences</h2>
            <p className="text-sm text-gray-400 mt-0.5">{prefs.length} applicant{prefs.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg cursor-pointer"
            style={{ backgroundColor: '#009639' }}
          >
            + Add Applicant
          </button>
        </div>
      )}

      {/* List */}
      {!showForm && !editing && (
        prefs.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-400 mb-4 text-sm">No applicants yet.</p>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm font-semibold text-white rounded-lg cursor-pointer" style={{ backgroundColor: '#0B4F6C' }}>
              Add First Applicant
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {prefs.map(pref => (
              <div key={pref.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-gray-900 text-sm">{pref.client?.full_name ?? '-'}</span>
                      <span className="text-xs font-mono text-gray-400">{pref.client?.client_code}</span>
                      {!pref.is_active && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Paused</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {(pref.search_links ?? []).length} search link{(pref.search_links ?? []).length !== 1 ? 's' : ''}
                      {pref.role_keywords.length > 0 && <span className="ml-2">· {pref.role_keywords.slice(0, 3).join(', ')}</span>}
                    </p>
                    {pref.notes && <p className="text-xs text-gray-400 mt-1 italic">{pref.notes}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setEditing(pref); setShowForm(false) }}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(pref)}
                      disabled={deleting === pref.client_id}
                      className="px-3 py-1.5 text-xs border border-red-200 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
                    >
                      {deleting === pref.client_id ? '...' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
