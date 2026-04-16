'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAdminToken } from '@/lib/admin-context'
import type { ApplicantPreferences, EmploymentType, VacancySource } from '@/lib/vacancy/types'
import type { Client } from '@/lib/types'

const ALL_SOURCES: { value: VacancySource; label: string }[] = [
  { value: 'england', label: 'NHS England (jobs.nhs.uk)' },
  { value: 'scotland', label: 'NHS Scotland (apply.jobs.scot.nhs.uk)' },
  { value: 'civil-service', label: 'Civil Service (civilservicejobs.service.gov.uk)' },
  { value: 'healthjobsuk', label: 'HealthJobsUK (healthjobsuk.com)' },
]

const COMMON_BANDS = ['Band 2', 'Band 3', 'Band 4', 'Band 5', 'Band 6', 'Band 7', 'Band 8a', 'Band 8b']

function TagInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
  hint?: string
}) {
  const [input, setInput] = useState('')

  const addTag = (val: string) => {
    const trimmed = val.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === 'Backspace' && !input && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-md min-h-[44px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-blue-600 hover:text-blue-900 cursor-pointer"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) addTag(input) }}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm text-gray-700 bg-transparent"
        />
      </div>
    </div>
  )
}

function BandPicker({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (band: string) => {
    if (selected.includes(band)) onChange(selected.filter((b) => b !== band))
    else onChange([...selected, band])
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">NHS Pay Bands</label>
      <p className="text-xs text-gray-500 mb-2">Select all bands this applicant is eligible for (leave empty = any band)</p>
      <div className="flex flex-wrap gap-2">
        {COMMON_BANDS.map((band) => (
          <button
            key={band}
            type="button"
            onClick={() => toggle(band)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer transition-colors ${
              selected.includes(band)
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
            }`}
          >
            {band}
          </button>
        ))}
      </div>
    </div>
  )
}

function PreferenceForm({
  clients,
  existing,
  token,
  onSaved,
  onCancel,
}: {
  clients: Client[]
  existing?: ApplicantPreferences | null
  token: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [clientId, setClientId] = useState(existing?.client_id || '')
  const [locations, setLocations] = useState<string[]>(existing?.locations || [])
  const [bands, setBands] = useState<string[]>(existing?.bands || [])
  const [roleKeywords, setRoleKeywords] = useState<string[]>(existing?.role_keywords || [])
  const [employmentType, setEmploymentType] = useState<EmploymentType>(existing?.employment_type || 'any')
  const [sources, setSources] = useState<VacancySource[]>(
    existing?.sources || ['england', 'scotland', 'civil-service', 'healthjobsuk']
  )
  const [notes, setNotes] = useState(existing?.notes || '')
  const [nhsJobsUrl, setNhsJobsUrl] = useState(existing?.nhs_jobs_url || '')
  const [healthjobsUrl, setHealthjobsUrl] = useState(existing?.healthjobs_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleSource = (source: VacancySource) => {
    if (sources.includes(source)) setSources(sources.filter((s) => s !== source))
    else setSources([...sources, source])
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) { setError('Please select an applicant'); return }
    if (roleKeywords.length === 0) { setError('Please add at least one role keyword'); return }
    if (sources.length === 0) { setError('Please select at least one job board'); return }

    setSaving(true)
    setError('')
    const res = await fetch('/api/vacancies/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ client_id: clientId, locations, bands, role_keywords: roleKeywords, employment_type: employmentType, sources, notes, nhs_jobs_url: nhsJobsUrl || null, healthjobs_url: healthjobsUrl || null }),
    })
    setSaving(false)
    if (res.ok) onSaved()
    else {
      const d = await res.json()
      setError(d.error || 'Failed to save')
    }
  }

  // Clients that don't already have preferences (unless editing)
  const availableClients = existing
    ? clients
    : clients.filter((c) => c.is_active)

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Client selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Applicant</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={!!existing}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
        >
          <option value="">— Select applicant —</option>
          {availableClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} ({c.client_code})
            </option>
          ))}
        </select>
      </div>

      {/* Role keywords */}
      <TagInput
        label="Role Keywords"
        values={roleKeywords}
        onChange={setRoleKeywords}
        placeholder="Type a role and press Enter..."
        hint="e.g. Staff Nurse, Support Worker, Project Manager — synonyms are matched automatically"
      />

      {/* Locations */}
      <TagInput
        label="Preferred Locations"
        values={locations}
        onChange={setLocations}
        placeholder="e.g. Edinburgh, Glasgow, Scotland, England..."
        hint="Type a city, region, or 'Scotland'/'England' for broad matching. Leave empty = anywhere."
      />

      {/* Bands */}
      <BandPicker selected={bands} onChange={setBands} />

      {/* Employment type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
        <div className="flex gap-3">
          {(['any', 'full-time', 'part-time'] as EmploymentType[]).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="employmentType"
                value={type}
                checked={employmentType === type}
                onChange={() => setEmploymentType(type)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 capitalize">{type === 'any' ? 'Any' : type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Job boards */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Job Boards to Monitor</label>
        <div className="space-y-2">
          {ALL_SOURCES.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sources.includes(value)}
                onChange={() => toggleSource(value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Direct search URLs */}
      <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-0.5">Direct Search URLs (optional)</p>
          <p className="text-xs text-gray-500 mb-3">
            Go to the job board, set your filters (location, band, role), then copy and paste the full URL here.
            A link will appear on the dashboard so you can open the pre-filtered search instantly.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">NHS Jobs URL</label>
          <input
            type="url"
            value={nhsJobsUrl}
            onChange={(e) => setNhsJobsUrl(e.target.value)}
            placeholder="https://www.jobs.nhs.uk/candidate/search/results?..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">HealthJobsUK URL</label>
          <input
            type="url"
            value={healthjobsUrl}
            onChange={(e) => setHealthjobsUrl(e.target.value)}
            placeholder="https://www.healthjobsuk.com/job_list?..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any notes about this applicant's preferences..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-md cursor-pointer disabled:opacity-60"
          style={{ backgroundColor: '#005eb8' }}
        >
          {saving ? 'Saving...' : existing ? 'Update Preferences' : 'Add Applicant'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function PreferencesPage() {
  const { token } = useAdminToken()
  const [clients, setClients] = useState<Client[]>([])
  const [prefs, setPrefs] = useState<ApplicantPreferences[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ApplicantPreferences | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [clientsRes, prefsRes] = await Promise.all([
      fetch('/api/clients', { headers: { 'x-admin-token': token } }),
      fetch('/api/vacancies/preferences', { headers: { 'x-admin-token': token } }),
    ])
    if (clientsRes.ok) setClients(await clientsRes.json())
    if (prefsRes.ok) setPrefs(await prefsRes.json())
    setLoading(false)
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaved = () => {
    setShowForm(false)
    setEditing(null)
    fetchData()
  }

  const handleDelete = async (pref: ApplicantPreferences) => {
    const name = pref.client?.full_name || 'this applicant'
    if (!confirm(`Remove vacancy monitoring for ${name}?`)) return
    setDeleting(pref.client_id)
    await fetch(`/api/vacancies/preferences?client_id=${pref.client_id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token },
    })
    setPrefs((prev) => prev.filter((p) => p.client_id !== pref.client_id))
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#005eb8' }} />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-6">
      {/* Sub-nav back link */}
      <div className="mb-4">
        <Link href="/admin/vacancies" className="text-sm text-blue-700 hover:underline">
          ← Back to Vacancy Dashboard
        </Link>
      </div>
        {/* Add new form */}
        {(showForm || editing) ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {editing ? `Edit Preferences — ${editing.client?.full_name}` : 'Add Applicant'}
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
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                {prefs.length} applicant{prefs.length !== 1 ? 's' : ''} monitored
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Each applicant&apos;s preferences are matched against all 4 job boards
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm font-semibold text-white rounded-md cursor-pointer"
              style={{ backgroundColor: '#009639' }}
            >
              + Add Applicant
            </button>
          </div>
        )}

        {/* Preferences list */}
        {prefs.length === 0 && !showForm ? (
          <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
            <p className="text-gray-500 mb-4">No applicants set up yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm font-semibold text-white rounded-md cursor-pointer"
              style={{ backgroundColor: '#005eb8' }}
            >
              Add First Applicant
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {prefs.map((pref) => (
              <div key={pref.id} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900 text-sm">
                        {pref.client?.full_name || 'Unknown'}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{pref.client?.client_code}</span>
                      {!pref.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Paused</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {pref.role_keywords.map((k) => (
                        <span key={k} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                          {k}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {pref.locations.length > 0 && (
                        <span>📍 {pref.locations.join(', ')}</span>
                      )}
                      {pref.bands.length > 0 && (
                        <span>🎯 {pref.bands.join(', ')}</span>
                      )}
                      <span>
                        🕐 {pref.employment_type === 'any' ? 'Any hours' : pref.employment_type}
                      </span>
                      <span>
                        🌐 {pref.sources.length === 4 ? 'All boards' : pref.sources.join(', ')}
                      </span>
                    </div>

                    {pref.notes && (
                      <p className="text-xs text-gray-400 mt-1.5 italic">{pref.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setEditing(pref); setShowForm(false) }}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(pref)}
                      disabled={deleting === pref.client_id}
                      className="px-3 py-1.5 text-xs border border-red-200 rounded-md hover:bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
                    >
                      {deleting === pref.client_id ? '...' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
