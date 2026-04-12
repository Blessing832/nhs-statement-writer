'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    work_history: '',
    qualifications: '',
    skills: '',
    background: '',
    subscription_months: '1',
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : ''

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) {
      setError('Client name is required')
      return
    }
    setSaving(true)
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token,
      },
      body: JSON.stringify({
        ...form,
        subscription_months: parseInt(form.subscription_months),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      router.push(`/admin/clients/${data.id}?created=1`)
    } else {
      setError(data.error || 'Failed to create client')
    }
  }

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
          <h1 className="text-white text-xl font-semibold">Add New Client</h1>
        </div>
      </header>
      <div style={{ backgroundColor: '#005eb8' }} className="h-2" />

      <div className="max-w-3xl mx-auto w-full px-6 py-8">
        <Link href="/admin" className="text-sm text-blue-700 hover:underline mb-6 inline-block">
          ← Back to dashboard
        </Link>

        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Client Details</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="Full Name" required>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder="e.g. Sarah Johnson"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </Field>

            <Field label="Work History" hint="Previous roles, employers, dates">
              <textarea
                value={form.work_history}
                onChange={(e) => handleChange('work_history', e.target.value)}
                placeholder="e.g. Band 5 Staff Nurse at Royal London Hospital (2020–2024). Healthcare Assistant at Barking, Havering and Redbridge NHS Trust (2018–2020)..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </Field>

            <Field label="Qualifications" hint="Degrees, diplomas, certificates, NMC registration etc.">
              <textarea
                value={form.qualifications}
                onChange={(e) => handleChange('qualifications', e.target.value)}
                placeholder="e.g. BSc Nursing (Adult) — University of East London, 2020. NMC Registered (PIN: 20H1234E). Level 3 NVQ Health and Social Care..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </Field>

            <Field label="Skills" hint="Clinical skills, software, languages, leadership, etc.">
              <textarea
                value={form.skills}
                onChange={(e) => handleChange('skills', e.target.value)}
                placeholder="e.g. IV cannulation, wound care, medicines management, EMIS Web, SystmOne, team supervision, patient education..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </Field>

            <Field
              label="Background & Special Information"
              hint="NHS experience, specific projects, volunteer work, tools, anything else relevant"
            >
              <textarea
                value={form.background}
                onChange={(e) => handleChange('background', e.target.value)}
                placeholder="e.g. 6 years NHS experience. Led a ward improvement project reducing medication errors by 30%. Volunteer at local food bank. Completed NHS Leadership Academy Foundations programme..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </Field>

            <Field label="Subscription Length">
              <select
                value={form.subscription_months}
                onChange={(e) => handleChange('subscription_months', e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="1">1 month</option>
                <option value="2">2 months</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
              </select>
            </Field>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-white font-medium rounded-md cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: '#009639' }}
              >
                {saving ? 'Creating...' : 'Create Client'}
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
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
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
