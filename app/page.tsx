'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [clientCode, setClientCode] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = clientCode.trim().toUpperCase()
    if (!code) {
      setError('Please enter your client code')
      return
    }
    router.push(`/generate?code=${encodeURIComponent(code)}`)
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ backgroundColor: '#003087' }} className="py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div
            style={{ backgroundColor: '#005eb8' }}
            className="w-10 h-10 rounded flex items-center justify-center"
          >
            <span className="text-white font-bold text-sm">NHS</span>
          </div>
          <h1 className="text-white text-xl font-semibold">Statement Writer</h1>
        </div>
      </header>

      <div style={{ backgroundColor: '#005eb8' }} className="h-2" />

      {/* Hero */}
      <div style={{ backgroundColor: '#005eb8' }} className="py-12 px-6">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-3">NHS &amp; Civil Service Statement Writer</h2>
          <p className="text-lg opacity-90">
            Professional supporting statements tailored to your job application — generated in minutes.
          </p>
        </div>
      </div>

      {/* Main card */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Enter your client code</h3>
            <p className="text-gray-600 text-sm mb-6">
              Your unique code was provided when you signed up. Enter it below to get started.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Code
                </label>
                <input
                  type="text"
                  value={clientCode}
                  onChange={(e) => {
                    setClientCode(e.target.value)
                    setError('')
                  }}
                  placeholder="e.g. NHSAB123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  autoComplete="off"
                  spellCheck={false}
                />
                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 text-white font-semibold rounded-md cursor-pointer"
                style={{ backgroundColor: '#005eb8' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#003087')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#005eb8')}
              >
                Continue
              </button>
            </form>
          </div>

          <p className="text-center mt-4 text-sm text-gray-500">
            Administrator?{' '}
            <a href="/admin" className="text-blue-700 hover:underline">
              Sign in here
            </a>
          </p>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-200">
        Independent writing tool. Not affiliated with NHS or UK Civil Service.
      </footer>
    </main>
  )
}
