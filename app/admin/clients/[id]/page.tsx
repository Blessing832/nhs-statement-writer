'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Client } from '@/lib/types'
import { SCOTLAND_Q2_VARIATIONS } from '@/lib/scotland-q2-variations'

const OPENING_STYLES = [
  {
    id: '1',
    name: 'Standard',
    desc: 'Classic NHS opening: title then advert keywords',
    preview: '"I am an experienced [title] who is [2-3 keywords from advert]..."',
    template: 'Open with: "I am an experienced [EXACT vacancy title] who is [2-3 exact keyword phrases lifted directly from the advert]."',
  },
  {
    id: '2',
    name: 'Experience-first',
    desc: 'Lead with years of experience, then bring skills to role',
    preview: '"With [X] years of experience in [specialty], I bring [skills] to this role..."',
    template: 'Open with: "With [X] years of experience in [specialty] care, I bring [2 skills from person spec] to this [vacancy title] role at [Trust]."',
  },
  {
    id: '3',
    name: 'Qualification-first',
    desc: 'Lead with qualification, then experience combination',
    preview: '"Holding [qualification] and [X] years in [specialty], I offer [Trust]..."',
    template: 'Open with: "Holding [qualification] and [X] years of hands-on experience in [specialty], I offer [Trust] a combination of [skill 1] and [skill 2] that the person specification identifies as essential."',
  },
  {
    id: '4',
    name: 'Journey-led',
    desc: 'Career journey framed as a natural next step',
    preview: '"My career in [specialty] began [X] years ago, and the skills I have built make this role a natural next step."',
    template: 'Open with: "My career in [specialty] care began [X] years ago, and the skills I have built — [2-3 skills from person spec] — make the [vacancy title] role at [Trust] a natural next step."',
  },
  {
    id: '5',
    name: 'Patient-focused',
    desc: 'Opens with patient care as the anchor of the career',
    preview: '"Caring for patients with [condition] has shaped every aspect of my professional development..."',
    template: 'Open with: "Caring for patients with [condition/patient group from JD] has shaped every aspect of my professional development, and the [vacancy title] role at [Trust] aligns directly with the [specialty] experience I have built over [X] years."',
  },
  {
    id: '6',
    name: 'Values-led',
    desc: 'Opens with two personal values, links to Trust priorities',
    preview: '"Two values have guided my [X] years in care: [value 1] and [value 2]..."',
    template: 'Open with: "Two values have guided my [X] years in [specialty] care: [value 1 from person spec or advert] and [value 2]. The [vacancy title] post at [Trust] — with its emphasis on [advert keyword] — is the role I want to move into."',
  },
  {
    id: '7',
    name: 'Motivation-first',
    desc: 'Opens by naming exactly why this Trust and this role',
    preview: '"The opportunity to join [Trust] as [title] brings together everything I have worked toward..."',
    template: 'Open with: "The opportunity to join [Trust] as [vacancy title] brings together everything I have worked toward: [specialty] experience, [skill from person spec], and a commitment to [value or phrase from advert]."',
  },
  {
    id: '8',
    name: 'Impact-led',
    desc: 'Opens with what the candidate has achieved and built',
    preview: '"During my [X] years in [specialty], I have [achievement]..."',
    template: 'Open with: "During my [X] years in [specialty] care, I have [specific achievement or contribution], developed [skill from person spec], and built the direct experience of [patient group or procedure] that the [vacancy title] role at [Trust] requires."',
  },
  {
    id: '9',
    name: 'Setting-specific',
    desc: 'Highlights the range of care settings worked in',
    preview: '"Working across [specialty] settings — from [setting A] to [setting B] — has given me [skills]..."',
    template: 'Open with: "Working across [specialty] settings — from [setting 1] to [setting 2] — has given me [skills from person spec]. I am ready to bring this range of experience to the [vacancy title] role at [Trust]."',
  },
  {
    id: '10',
    name: 'Strength-led',
    desc: 'Opens with the combination of strengths the candidate offers',
    preview: '"The combination of my [qualification], [X] years in [specialty], and experience with [conditions]..."',
    template: 'Open with: "The combination of my [qualification], [X] years in [specialty], and direct experience supporting patients with [conditions from JD] makes me a strong candidate for the [vacancy title] post at [Trust]."',
  },
  {
    id: '11',
    name: 'Challenge-led',
    desc: 'Opens with the demands of the specialty, showing readiness',
    preview: '"Providing care for patients with [complex condition] demands [quality 1] and [quality 2]..."',
    template: 'Open with: "Providing care for patients with [complex condition or patient group from JD] demands [quality 1 from person spec] and [quality 2]. Over my [X] years as [current role], I have developed both — and I want to apply them as [vacancy title] at [Trust]."',
  },
  {
    id: '12',
    name: 'Current-role-first',
    desc: 'Opens with current role duties, then positions next step',
    preview: '"In my current role as [role] at [workplace], I [key duty]..."',
    template: 'Open with: "In my current role as [current role] at [current workplace], I [key responsibility using JD keywords]. Over [X] years in [specialty], I have built [skills from person spec], and I am ready to take the next step as [vacancy title] at [Trust]."',
  },
  {
    id: '13',
    name: 'Direct and Concise',
    desc: 'Short punchy opening, no padding or filler',
    preview: '"I am a [title] with [X] years of [specialty] experience. I hold [qualification]..."',
    template: 'Open with a short, direct statement: "I am a [vacancy title] with [X] years of [specialty] experience. I hold [qualification], and I apply because [specific reason directly from the advert that matches the candidate\'s background]."',
  },
  {
    id: '14',
    name: 'Team-led',
    desc: 'Opens with MDT and collaborative experience',
    preview: '"Working alongside [MDT roles] in [specialty] settings has shaped how I understand this role..."',
    template: 'Open with: "Working alongside [MDT roles from JD — e.g. registered nurses, occupational therapists, physiotherapists] in [specialty] settings has shaped how I understand the [vacancy title] role. My [X] years in [specialty] have prepared me to contribute to the team at [Trust]."',
  },
  {
    id: '15',
    name: 'Story-hook',
    desc: 'Opens with one specific patient moment, then pivots to the role',
    preview: '"[One-line patient story]. That moment reflects the care I bring every day..."',
    template: 'Begin with a single compelling sentence describing a specific patient moment or care challenge from the candidate\'s experience — no label, no introduction, just the scene. Then continue the first paragraph: "That moment reflects the approach I bring every day, and why I am applying for the [vacancy title] role at [Trust]."',
  },
  {
    id: '16',
    name: 'Reflective',
    desc: 'Opens with a genuine insight from years of care experience',
    preview: '"[Reflective insight about care]. This is what [X] years in [specialty] has taught me..."',
    template: 'Begin with one reflective sentence that captures a genuine insight the candidate has gained from their years in [specialty] — something specific to their experience, not a generic cliché. Then: "This is what [X] years in [specialty] care has given me, and it is the perspective I want to bring to the [vacancy title] role at [Trust]."',
  },
]

interface StatementLog {
  id: string
  vacancy_url: string
  job_title: string
  organisation: string
  is_rewrite: boolean
  rewrite_instruction?: string
  created_at: string
  totalForUrl: number
  flagged: boolean
}

export default function EditClientPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const justCreated = searchParams.get('created') === '1'

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(justCreated ? 'Client created successfully!' : '')
  const [statementLog, setStatementLog] = useState<StatementLog[]>([])
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [showQ2Picker, setShowQ2Picker] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    work_history: '',
    qualifications: '',
    skills: '',
    background: '',
    special_instructions: '',
    opening_style: '',
    scotland_q2_variation: '',
    subscription_end: '',
    is_active: true,
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : ''

  useEffect(() => {
    const fetchClient = async () => {
      const [clientRes, statementsRes] = await Promise.all([
        fetch(`/api/clients/${params.id}`, { headers: { 'x-admin-token': token } }),
        fetch(`/api/admin/clients/${params.id}/statements`, { headers: { 'x-admin-token': token } }),
      ])
      if (clientRes.ok) {
        const data: Client = await clientRes.json()
        setClient(data)
        setForm({
          full_name: data.full_name,
          work_history: data.work_history,
          qualifications: data.qualifications,
          skills: data.skills,
          background: data.background,
          special_instructions: data.special_instructions || '',
          opening_style: data.opening_style || '',
          scotland_q2_variation: data.scotland_q2_variation || '',
          subscription_end: data.subscription_end.split('T')[0],
          is_active: data.is_active,
        })
      }
      if (statementsRes.ok) {
        setStatementLog(await statementsRes.json())
      }
      setLoading(false)
    }
    fetchClient()
  }, [params.id, token])

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${params.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token,
      },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setSuccess('Client updated successfully')
      setClient(data)
    } else {
      setError(data.error || 'Failed to update')
    }
  }

  const handleExtend = (months: number) => {
    const base = new Date(form.subscription_end) > new Date() ? new Date(form.subscription_end) : new Date()
    base.setMonth(base.getMonth() + months)
    handleChange('subscription_end', base.toISOString().split('T')[0])
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!client) return <div className="p-8 text-red-600">Client not found</div>

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f4f5' }}>
      <header style={{ backgroundColor: '#003087' }} className="py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div
            className="w-10 h-10 rounded flex items-center justify-center"
            style={{ backgroundColor: '#005eb8' }}
          >
            <span className="text-white font-bold text-sm">NHS</span>
          </div>
          <h1 className="text-white text-xl font-semibold">Edit Client</h1>
        </div>
      </header>
      <div style={{ backgroundColor: '#005eb8' }} className="h-2" />

      <div className="max-w-3xl mx-auto w-full px-6 py-8">
        <Link href="/admin" className="text-sm text-blue-700 hover:underline mb-6 inline-block">
          Back to dashboard
        </Link>

        {/* Client code banner */}
        <div
          className="rounded-lg p-4 mb-6 text-white"
          style={{ backgroundColor: '#003087' }}
        >
          <p className="text-sm opacity-75">Client Code</p>
          <p className="text-2xl font-bold font-mono tracking-widest">{client.client_code}</p>
          <p className="text-sm opacity-75 mt-1">Share this code with your client</p>
        </div>

        {justCreated && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6 text-green-800 text-sm font-medium">
            Client created. Their code is <strong>{client.client_code}</strong> - share this with them now.
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Client Details</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="Full Name" required>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </Field>

            <Field label="Work History">
              <textarea
                value={form.work_history}
                onChange={(e) => handleChange('work_history', e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </Field>

            <Field label="Qualifications">
              <textarea
                value={form.qualifications}
                onChange={(e) => handleChange('qualifications', e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </Field>

            <Field label="Skills">
              <textarea
                value={form.skills}
                onChange={(e) => handleChange('skills', e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </Field>

            <Field label="Background & Special Information">
              <textarea
                value={form.background}
                onChange={(e) => handleChange('background', e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </Field>

            <Field label="Opening Style" hint="Choose the sentence structure the AI will use to open this candidate's statement. Click 'Choose style' to see all options.">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowStylePicker((v) => !v)}
                    className="text-sm px-3 py-1.5 rounded-md border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                  >
                    {showStylePicker ? 'Hide styles' : 'Choose style'}
                  </button>
                  {form.opening_style && (
                    <span className="text-xs text-gray-500 italic truncate max-w-xs">{OPENING_STYLES.find(s => s.template === form.opening_style)?.name ?? 'Custom'} selected</span>
                  )}
                  {form.opening_style && (
                    <button
                      type="button"
                      onClick={() => handleChange('opening_style', '')}
                      className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showStylePicker && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <p className="text-xs text-blue-700 font-medium mb-2">Click a style to select it for this candidate:</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {OPENING_STYLES.map((s) => {
                        const isSelected = form.opening_style === s.template
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { handleChange('opening_style', isSelected ? '' : s.template); setShowStylePicker(false) }}
                            className="text-left p-3 rounded-md border-2 transition-colors cursor-pointer"
                            style={isSelected
                              ? { borderColor: '#005eb8', backgroundColor: '#dbeafe' }
                              : { borderColor: '#e5e7eb', backgroundColor: 'white' }}
                          >
                            <p className="font-semibold text-sm text-gray-800">{s.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{s.desc}</p>
                            <p className="text-xs text-gray-400 mt-1 italic leading-snug line-clamp-2">{s.preview}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <textarea
                  value={form.opening_style}
                  onChange={(e) => handleChange('opening_style', e.target.value)}
                  rows={2}
                  placeholder="Selected style template will appear here — or type a custom opening instruction."
                  className="w-full px-4 py-2.5 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-blue-50"
                />
              </div>
            </Field>

            <Field label="Scotland Q2: Why NHS Scotland (preset)" hint="For Scotland applications only. Choose a pre-written 'why NHS Scotland' paragraph. The AI uses it verbatim (lightly personalised), then writes the Board paragraph and fills remaining Q2 budget with criteria.">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowQ2Picker((v) => !v)}
                    className="text-sm px-3 py-1.5 rounded-md border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 cursor-pointer"
                  >
                    {showQ2Picker ? 'Hide variations' : 'Choose variation'}
                  </button>
                  {form.scotland_q2_variation && (
                    <span className="text-xs text-gray-500 italic">
                      {SCOTLAND_Q2_VARIATIONS.find(v => v.id === form.scotland_q2_variation)?.name ?? 'Custom'} selected
                    </span>
                  )}
                  {form.scotland_q2_variation && (
                    <button
                      type="button"
                      onClick={() => handleChange('scotland_q2_variation', '')}
                      className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showQ2Picker && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                    <p className="text-xs text-green-700 font-medium mb-2">Click a variation to select it. The AI will use this as the opening of Q2:</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {SCOTLAND_Q2_VARIATIONS.map((v) => {
                        const isSelected = form.scotland_q2_variation === v.id
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => { handleChange('scotland_q2_variation', isSelected ? '' : v.id); setShowQ2Picker(false) }}
                            className="text-left p-3 rounded-md border-2 transition-colors cursor-pointer"
                            style={isSelected
                              ? { borderColor: '#16a34a', backgroundColor: '#dcfce7' }
                              : { borderColor: '#e5e7eb', backgroundColor: 'white' }}
                          >
                            <p className="font-semibold text-sm text-gray-800">{v.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{v.angle}</p>
                            <p className="text-xs text-gray-400 mt-1 leading-snug line-clamp-3 italic">{v.text.substring(0, 120)}…</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {form.scotland_q2_variation && (
                  <div className="rounded-md border border-green-200 bg-white p-3">
                    <p className="text-xs font-medium text-green-700 mb-1">Preview (first 200 chars):</p>
                    <p className="text-xs text-gray-600 leading-relaxed italic">
                      {SCOTLAND_Q2_VARIATIONS.find(v => v.id === form.scotland_q2_variation)?.text.substring(0, 200)}…
                    </p>
                  </div>
                )}
              </div>
            </Field>

            <Field label="Special Instructions for AI" hint="These override the AI. Use for things that must never change, e.g. exact job titles, specific experiences to highlight or exclude.">
              <textarea
                value={form.special_instructions}
                onChange={(e) => handleChange('special_instructions', e.target.value)}
                rows={3}
                placeholder="e.g. Previous job title must stay as 'Senior Nursing Officer' - do not change or rephrase it. Always highlight her community nursing experience first."
                className="w-full px-4 py-2.5 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-amber-50"
              />
            </Field>

            <Field label="Subscription End Date">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="date"
                  value={form.subscription_end}
                  onChange={(e) => handleChange('subscription_end', e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-sm text-gray-500">Extend by:</span>
                {[1, 2, 3].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleExtend(m)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-700 cursor-pointer"
                  >
                    +{m}mo
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Status">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Active (client can generate statements)</span>
              </label>
            </Field>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-green-700 text-sm">
                {success}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-white font-medium rounded-md cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: '#005eb8' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href="/admin"
                className="px-6 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Statement History */}
        {statementLog.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 mt-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Statement History</h2>
              {statementLog.some((s) => s.flagged) && (
                <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium">
                  Flag: same link generated more than twice
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {statementLog.map((s) => (
                <div key={s.id} className={`px-6 py-3 text-sm ${s.flagged ? 'bg-red-50' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{s.job_title || 'Unknown role'}</p>
                      <p className="text-gray-500 text-xs truncate">{s.vacancy_url}</p>
                      {s.is_rewrite && s.rewrite_instruction && (
                        <p className="text-amber-700 text-xs mt-0.5">Rewrite: {s.rewrite_instruction}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.is_rewrite && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">Rewrite</span>
                      )}
                      {s.flagged && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                          {s.totalForUrl}x this URL
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}
