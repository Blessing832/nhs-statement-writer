'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Client } from '@/lib/types'

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
  const [form, setForm] = useState({
    full_name: '',
    work_history: '',
    qualifications: '',
    skills: '',
    background: '',
    special_instructions: '',
    subscription_end: '',
    is_active: true,
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : ''

  useEffect(() => {
    const fetchClient = async () => {
      const res = await fetch(`/api/clients/${params.id}`, {
        headers: { 'x-admin-token': token },
      })
      if (res.ok) {
        const data: Client = await res.json()
        setClient(data)
        setForm({
          full_name: data.full_name,
          work_history: data.work_history,
          qualifications: data.qualifications,
          skills: data.skills,
          background: data.background,
          special_instructions: data.special_instructions || '',
          subscription_end: data.subscription_end.split('T')[0],
          is_active: data.is_active,
        })
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
          ← Back to dashboard
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
            Client created. Their code is <strong>{client.client_code}</strong> — share this with them now.
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

            <Field label="Special Instructions for AI" hint="These override the AI. Use for things that must never change, e.g. exact job titles, specific experiences to highlight or exclude.">
              <textarea
                value={form.special_instructions}
                onChange={(e) => handleChange('special_instructions', e.target.value)}
                rows={3}
                placeholder="e.g. Previous job title must stay as 'Senior Nursing Officer' — do not change or rephrase it. Always highlight her community nursing experience first."
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
