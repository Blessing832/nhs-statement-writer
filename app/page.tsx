'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

// ── Black-and-white woman illustration ───────────────────────────────────────
function WomanIllustration() {
  return (
    <svg
      viewBox="0 0 460 510"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full max-w-sm mx-auto"
    >
      {/* Soft background circle */}
      <circle cx="230" cy="270" r="210" fill="#EEF4FB" />

      {/* Decorative dots */}
      <circle cx="52" cy="185" r="9" fill="#005eb8" opacity="0.18" />
      <circle cx="408" cy="155" r="6" fill="#003087" opacity="0.15" />
      <circle cx="40" cy="390" r="13" fill="#005eb8" opacity="0.12" />
      <circle cx="425" cy="400" r="8" fill="#003087" opacity="0.13" />

      {/* Gold star top-right */}
      <path
        d="M395 112 L398.4 121.6 L409 121.6 L400.8 127.8 L404.2 137.4 L395 131.2 L385.8 137.4 L389.2 127.8 L381 121.6 L391.6 121.6Z"
        fill="#FFB800"
        opacity="0.9"
      />
      {/* Small star left */}
      <path
        d="M58 248 L60.4 254.8 L67.6 254.8 L61.9 259 L64.3 265.8 L58 261.6 L51.7 265.8 L54.1 259 L48.4 254.8 L55.6 254.8Z"
        fill="#FFB800"
        opacity="0.75"
      />

      {/* Confetti rectangles */}
      <rect x="75" y="145" width="10" height="10" rx="2" fill="#005eb8" opacity="0.22" transform="rotate(30 80 150)" />
      <rect x="368" y="275" width="8" height="8" rx="2" fill="#003087" opacity="0.2" transform="rotate(-20 372 279)" />
      <rect x="390" y="205" width="6" height="6" rx="1" fill="#005eb8" opacity="0.18" transform="rotate(45 393 208)" />

      {/* ── LEGS ── */}
      <rect x="192" y="368" width="30" height="102" rx="14" fill="#1a1a1a" />
      <rect x="238" y="368" width="30" height="102" rx="14" fill="#2d2d2d" />

      {/* SHOES */}
      <ellipse cx="207" cy="467" rx="26" ry="10" fill="#111" />
      <ellipse cx="253" cy="467" rx="26" ry="10" fill="#111" />

      {/* LOWER BODY / SKIRT */}
      <path d="M173 280 L186 375 H274 L287 280Z" fill="#2d2d2d" />

      {/* BLAZER / JACKET */}
      <path d="M160 192 L168 280 H292 L300 192 L266 185 L230 225 L194 185Z" fill="#1a1a1a" />

      {/* White shirt collar */}
      <path d="M202 185 L230 220 L258 185 L248 179 L230 202 L212 179Z" fill="white" />

      {/* NECK */}
      <rect x="220" y="168" width="20" height="28" rx="10" fill="#d0c0b8" />

      {/* ── HEAD ── */}
      <circle cx="230" cy="135" r="57" fill="#d0c0b8" />

      {/* HAIR — natural/afro style */}
      <circle cx="230" cy="103" r="50" fill="#1a1a1a" />
      <circle cx="178" cy="128" r="26" fill="#1a1a1a" />
      <circle cx="282" cy="128" r="26" fill="#1a1a1a" />
      <path d="M183 106 Q188 83 230 79 Q272 83 277 106" fill="#1a1a1a" />

      {/* FACE — happy squinting eyes */}
      <path d="M207 126 Q216 118 224 126" stroke="#1a1a1a" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M236 126 Q245 118 253 126" stroke="#1a1a1a" strokeWidth="3.2" strokeLinecap="round" />

      {/* Nose */}
      <path d="M228 137 Q225 147 230 149 Q235 147 232 137" stroke="#b09088" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Big smile */}
      <path d="M210 157 Q230 176 250 157" stroke="#1a1a1a" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      {/* Teeth */}
      <path d="M210 157 Q230 168 250 157 Q234 162 210 157Z" fill="white" />

      {/* Cheeks */}
      <circle cx="208" cy="152" r="10" fill="#d07060" opacity="0.28" />
      <circle cx="252" cy="152" r="10" fill="#d07060" opacity="0.28" />

      {/* ── LEFT ARM — raised in celebration ── */}
      <path d="M168 218 Q128 182 105 154" stroke="#d0c0b8" strokeWidth="27" strokeLinecap="round" />
      <circle cx="107" cy="152" r="17" fill="#d0c0b8" />
      {/* Fingers hint */}
      <path d="M100 142 Q107 135 114 142" stroke="#b09888" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* ── RIGHT ARM — holding document ── */}
      <path d="M292 218 Q330 238 352 258" stroke="#d0c0b8" strokeWidth="27" strokeLinecap="round" />

      {/* DOCUMENT */}
      <rect x="338" y="244" width="74" height="92" rx="7" fill="white" stroke="#333" strokeWidth="2" />
      {/* Text lines */}
      <rect x="350" y="262" width="48" height="3" rx="1.5" fill="#e0e0e0" />
      <rect x="350" y="273" width="42" height="3" rx="1.5" fill="#e0e0e0" />
      <rect x="350" y="284" width="48" height="3" rx="1.5" fill="#e0e0e0" />
      <rect x="350" y="295" width="35" height="3" rx="1.5" fill="#e0e0e0" />
      {/* NHS-blue checkmark badge */}
      <circle cx="375" cy="318" r="13" fill="#005eb8" />
      <path d="M368 318 L373.5 324 L384 311" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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

            {/* RIGHT: illustration */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut', delay: 0.15 }}
              className="order-1 md:order-2 flex justify-center"
            >
              <div className="animate-float w-full">
                <WomanIllustration />
              </div>

              {/* Floating stat cards */}
              <div className="hidden md:block" />
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
