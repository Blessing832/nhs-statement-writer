'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

// ── Update this to your WhatsApp link ─────────────────────────────────────────
const CONTACT_URL = 'https://wa.me/447000000000'

// ── FAQ data ──────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'How does it work?',
    a: 'Paste the link to your NHS Jobs (or HealthJobsUK / Civil Service) vacancy and enter your client code. The tool reads the job description and person specification, then writes a supporting statement matched to every essential criterion — ready in about 2 minutes.',
  },
  {
    q: 'What does "criteria-matched" mean?',
    a: 'Every NHS supporting statement is scored against the person specification. Our tool identifies each essential and desirable criterion, then structures the statement to address each one with evidence — so shortlisting panels can tick every box.',
  },
  {
    q: 'Is my personal information secure?',
    a: 'Your profile and generated statements are stored securely and are never shared with third parties or used to train AI models. Each client code gives access only to your own data.',
  },
  {
    q: 'Will the hiring panel know I used this?',
    a: 'No. The statement is generated from your own work history and experience, written in a professional first-person voice. It reads as your own work because the evidence and facts are entirely yours.',
  },
  {
    q: 'Can I edit the statement after it is generated?',
    a: 'Yes. You receive a fully editable Word document. You can also use the built-in rewrite tool to refine specific sections — just describe what you want changed.',
  },
  {
    q: 'What if I want changes or am not happy with the result?',
    a: 'Use the rewrite option on your statement to request specific changes. If you need further help, contact your consultant directly via WhatsApp.',
  },
]

// ── Feature pill ─────────────────────────────────────────────────────────────
function FeaturePill({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm text-sm text-gray-700">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────
function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="py-14 px-6 border-t border-gray-100 bg-white">
      <div className="max-w-2xl mx-auto">
        <p className="text-center text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">Got questions?</p>
        <h2 className="text-center text-2xl md:text-3xl font-extrabold text-gray-900 mb-10">Frequently asked</h2>
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 text-sm pr-4">{faq.q}</span>
                <span
                  className="text-gray-400 text-lg flex-shrink-0 transition-transform duration-200"
                  style={{ transform: open === i ? 'rotate(45deg)' : 'none' }}
                >
                  +
                </span>
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-sm text-gray-600 leading-relaxed bg-gray-50">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-8">
          Still have questions?{' '}
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
            style={{ color: '#0B4F6C' }}
          >
            Message us on WhatsApp →
          </a>
        </p>
      </div>
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [clientCode, setClientCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = clientCode.trim().toUpperCase()
    if (!code) { setError('Please enter your client code'); return }
    setChecking(true)
    setError('')
    try {
      const res = await fetch(`/api/client-info?code=${encodeURIComponent(code)}`)
      if (!res.ok) {
        setError('Code not recognised. Please check and try again.')
        return
      }
      router.push(`/generate?code=${encodeURIComponent(code)}`)
    } catch {
      setError('Could not connect. Please check your internet and try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-white">

      {/* ── Header ── */}
      <header style={{ backgroundColor: '#072f42' }} className="py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 32, height: 32, border: '2px solid #F4A800', borderRadius: '50%', position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '50%', left: '18%', right: '18%', height: 2, background: '#fff', transform: 'translateY(-50%)' }} />
              <div style={{ position: 'absolute', left: '50%', top: '18%', bottom: '18%', width: 2, background: '#F4A800', transform: 'translateX(-50%)' }} />
            </div>
            <div>
              <h1 style={{ fontFamily: "var(--font-fraunces), 'Fraunces', serif", fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: -0.3, lineHeight: 1 }}>
                Ease<span style={{ color: '#F4A800' }}>Me</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Statement Writer</p>
            </div>
          </div>
          <a
            href="/admin"
            className="text-xs hover:text-white transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Admin →
          </a>
        </div>
      </header>

      {/* ── Gold accent bar ── */}
      <div style={{ backgroundColor: '#F4A800' }} className="h-0.5" />

      {/* ── Hero section ── */}
      <div className="flex-1 flex items-stretch overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #ffffff 50%, #f0f4f5 100%)' }}>
        <div className="max-w-6xl mx-auto w-full px-6 py-10 md:py-16 flex items-center">
          <div className="grid md:grid-cols-2 gap-10 items-stretch w-full">

            {/* LEFT: copy + form */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="order-2 md:order-1"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ backgroundColor: '#0B4F6C', color: 'white' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                NHS &amp; Civil Service Applications
              </div>

              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
                Land Your
                <span style={{ color: '#0B4F6C' }} className="block">NHS Job</span>
                Faster
              </h2>
              <p className="text-gray-500 text-base mb-6 leading-relaxed">
                Professional supporting statements tailored to your specific application: evidence-based, criteria-matched, and ready in minutes.
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
                    disabled={checking}
                    className="w-full py-3.5 px-6 text-white font-bold rounded-xl cursor-pointer transition-all text-base shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#0B4F6C' }}
                    onMouseEnter={(e) => { if (!checking) e.currentTarget.style.backgroundColor = '#072f42' }}
                    onMouseLeave={(e) => { if (!checking) e.currentTarget.style.backgroundColor = '#0B4F6C' }}
                  >
                    {checking ? 'Checking...' : 'Continue'}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-4">
                  Don&apos;t have a code?{' '}
                  <a
                    href={CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2"
                    style={{ color: '#0B4F6C' }}
                  >
                    Get in touch on WhatsApp →
                  </a>
                </p>
              </div>
            </motion.div>

            {/* RIGHT: hero photo */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
              className="order-1 md:order-2 hidden md:block"
              style={{ margin: '-2.5rem -1.5rem -2.5rem 0' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero.jpg"
                alt=""
                className="w-full h-full object-cover"
                style={{ minHeight: 520 }}
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Coverage strip ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="border-t border-gray-100 py-5 px-6"
        style={{ backgroundColor: '#f8faff' }}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span style={{ color: '#0B4F6C' }} className="font-bold text-lg">NHS</span>
            <span>England &amp; Wales</span>
          </div>
          <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span style={{ color: '#0B4F6C' }} className="font-bold text-lg">NHS</span>
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

      {/* ── Social proof / testimonials ── */}
      <section className="py-14 px-6 border-t border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">Candidate outcomes</p>
          <h2 className="text-center text-2xl md:text-3xl font-extrabold text-gray-900 mb-10" style={{ textWrap: 'balance' } as React.CSSProperties}>
            Real candidates. Real results.
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                quote: 'I had three applications out at once. EaseMe meant I could get a proper statement in for all three instead of rushing one. I got two interviews.',
                role: 'Band 6 Occupational Therapist',
                trust: 'NHS England',
                month: 'July 2026',
              },
              {
                quote: 'My previous statements were never getting past shortlisting. This one covered every criterion on the person spec. I got the job.',
                role: 'Senior Healthcare Assistant',
                trust: 'NHS Scotland',
                month: 'June 2026',
              },
              {
                quote: 'As someone who struggles with written English, having a tool that turns my experience into a professional statement has been life-changing.',
                role: 'Band 5 Staff Nurse',
                trust: 'NHS England & Wales',
                month: 'August 2026',
              },
            ].map((t, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50 p-6 flex flex-col gap-4">
                <p className="text-gray-700 text-sm leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.role}</p>
                  <p className="text-xs text-gray-400">{t.trust} · {t.month}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <FaqSection />

      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-200">
        Independent writing tool · Not affiliated with NHS or UK Civil Service
        <span className="mx-2">·</span>
        <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-600">Contact us</a>
      </footer>
    </main>
  )
}
