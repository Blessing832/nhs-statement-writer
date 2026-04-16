'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

// ── Feature pill ─────────────────────────────────────────────────────────────
function FeaturePill({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm text-sm text-gray-700">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [clientCode, setClientCode] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = clientCode.trim().toUpperCase()
    if (!code) { setError('Please enter your client code'); return }
    router.push(`/generate?code=${encodeURIComponent(code)}`)
  }

  return (
    <main className="min-h-screen flex flex-col bg-white">

      {/* ── Header ── */}
      <header style={{ backgroundColor: '#003087' }} className="py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              style={{ backgroundColor: '#005eb8' }}
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
            >
              <span className="text-white font-bold text-sm">NHS</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">EaseMe</h1>
              <p className="text-blue-300 text-xs leading-tight">Statement Writer</p>
            </div>
          </div>
          <a
            href="/admin"
            className="text-xs text-blue-300 hover:text-white transition-colors"
          >
            Admin →
          </a>
        </div>
      </header>

      {/* ── Blue accent bar ── */}
      <div style={{ backgroundColor: '#005eb8' }} className="h-1" />

      {/* ── Hero section ── */}
      <div className="flex-1 flex items-center" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #ffffff 50%, #f0f4f5 100%)' }}>
        <div className="max-w-6xl mx-auto w-full px-6 py-10 md:py-16">
          <div className="grid md:grid-cols-2 gap-10 items-center">

            {/* LEFT: copy + form */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="order-2 md:order-1"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ backgroundColor: '#005eb8', color: 'white' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                NHS &amp; Civil Service Applications
              </div>

              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
                Land Your
                <span style={{ color: '#005eb8' }} className="block">NHS Job</span>
                Faster
              </h2>
              <p className="text-gray-500 text-base mb-6 leading-relaxed">
                Professional supporting statements tailored to your specific application — evidence-based, criteria-matched, and ready in minutes.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 mb-8">
                <FeaturePill icon="✅" text="All essential criteria covered" />
                <FeaturePill icon="⚡" text="Ready in 2 minutes" />
                <FeaturePill icon="📄" text="Download as Word doc" />
              </div>

              {/* Code input card */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 text-lg mb-1">Get started</h3>
                <p className="text-gray-500 text-sm mb-5">
                  Enter the client code your consultant gave you.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Client Code
                    </label>
                    <input
                      type="text"
                      value={clientCode}
                      onChange={(e) => { setClientCode(e.target.value); setError('') }}
                      placeholder="e.g. NHSAB123"
                      className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-lg tracking-widest uppercase focus:outline-none focus:border-blue-600 transition-colors font-mono"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {error && (
                      <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                        <span>⚠</span> {error}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 text-white font-bold rounded-xl cursor-pointer transition-all text-base shadow-md hover:shadow-lg active:scale-[0.98]"
                    style={{ backgroundColor: '#005eb8' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#003087')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#005eb8')}
                  >
                    Continue →
                  </button>
                </form>
              </div>
            </motion.div>

            {/* RIGHT: hero photo */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut', delay: 0.15 }}
              className="order-1 md:order-2 flex justify-center"
            >
              <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Gemini_Generated_Image_tgikcjtgikcjtgik.png"
                  alt="Two women celebrating a job offer"
                  className="w-full h-full object-cover"
                  style={{ minHeight: 360, maxHeight: 480 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Social proof strip ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="border-t border-gray-100 py-5 px-6"
        style={{ backgroundColor: '#f8faff' }}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span style={{ color: '#005eb8' }} className="font-bold text-lg">NHS</span>
            <span>England &amp; Wales</span>
          </div>
          <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span style={{ color: '#005eb8' }} className="font-bold text-lg">NHS</span>
            <span>Scotland</span>
          </div>
          <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">✦</span>
            <span>Civil Service</span>
          </div>
          <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">✦</span>
            <span>HealthJobsUK</span>
          </div>
        </div>
      </motion.div>

      <footer className="py-3 text-center text-xs text-gray-400 border-t border-gray-200">
        Independent writing tool · Not affiliated with NHS or UK Civil Service
      </footer>
    </main>
  )
}
