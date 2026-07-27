'use client'
import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function WorkerLoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useSearchParams()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/worker-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    setLoading(false)

    if (res.ok) {
      const next = params.get('next') || '/'
      router.replace(next)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Incorrect password')
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'linear-gradient(135deg, #f0f4f5 0%, #e8eef5 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: '#003087' }}
          >
            <span className="text-white font-bold text-sm">NHS</span>
          </div>
          <div>
            <p className="text-gray-900 font-bold text-lg leading-tight">EaseMe</p>
            <p className="text-gray-500 text-xs leading-tight">Statement Writer</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Worker access</h1>
          <p className="text-sm text-gray-500 mb-6">Enter the team password to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Team password"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ '--tw-ring-color': '#005eb8' } as React.CSSProperties}
                disabled={loading}
                autoFocus
              />
              {error && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <span>⚠</span> {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 text-white font-semibold rounded-xl cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#005eb8' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#003087' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#005eb8' }}
            >
              {loading ? 'Checking…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          This area is for EaseMe staff only.
        </p>
      </div>
    </main>
  )
}

export default function WorkerLoginPage() {
  return (
    <Suspense>
      <WorkerLoginForm />
    </Suspense>
  )
}
