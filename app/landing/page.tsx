'use client'
import { motion } from 'framer-motion'

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`px-6 ${className}`}>{children}</section>
}

function ServiceCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3">
      <span className="text-3xl">{icon}</span>
      <h3 className="font-bold text-gray-900 text-lg leading-snug">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5"
        style={{ backgroundColor: '#005eb8' }}
      >
        {number}
      </div>
      <div>
        <p className="font-semibold text-gray-900 mb-1">{title}</p>
        <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">

      {/* ── Header ── */}
      <header style={{ backgroundColor: '#003087' }} className="py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              style={{ backgroundColor: '#005eb8' }}
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
            >
              <span className="text-white font-bold text-sm">NHS</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">EaseMe</h1>
              <p className="text-blue-300 text-xs leading-tight">NHS Careers Support</p>
            </div>
          </div>
          <a
            href="mailto:hello@easeme.live"
            className="text-sm text-white font-medium px-4 py-2 rounded-lg border border-blue-400 hover:bg-blue-800 transition-colors"
          >
            Get in touch
          </a>
        </div>
      </header>
      <div style={{ backgroundColor: '#005eb8' }} className="h-1" />

      {/* ── Hero ── */}
      <Section className="py-20 text-center" style={{ background: 'linear-gradient(160deg, #f0f4f5 0%, #ffffff 60%, #e8f0fa 100%)' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="max-w-3xl mx-auto"
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ backgroundColor: '#005eb8', color: 'white' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            NHS · Civil Service · Scotland · England &amp; Wales
          </div>

          <h2 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-5">
            Land your NHS job<br />
            <span style={{ color: '#005eb8' }}>with a statement that gets read.</span>
          </h2>

          <p className="text-gray-500 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            We write evidence-based NHS supporting statements that are personally tailored to your application — every essential and desirable criterion covered, in the format recruiters expect.
          </p>

          <a
            href="mailto:hello@easeme.live"
            className="inline-block px-8 py-4 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-base"
            style={{ backgroundColor: '#005eb8' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#003087' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#005eb8' }}
          >
            Get started today
          </a>

          <p className="text-sm text-gray-400 mt-4">
            Email us · We&apos;ll respond within a few hours
          </p>
        </motion.div>
      </Section>

      {/* ── Stats strip ── */}
      <div className="border-y border-gray-100 py-6 px-6" style={{ backgroundColor: '#f8faff' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: 'NHS England', label: '& Wales' },
            { value: 'NHS Scotland', label: 'Applications' },
            { value: 'Civil Service', label: 'Applications' },
            { value: 'HealthJobsUK', label: 'Applications' },
          ].map((stat) => (
            <div key={stat.value}>
              <p className="font-bold text-gray-900 text-base" style={{ color: '#003087' }}>{stat.value}</p>
              <p className="text-gray-500 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Services ── */}
      <Section className="py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">What we offer</h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              Everything you need to submit a confident, well-structured application — from NHS bands 2–9.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <ServiceCard
              icon="📄"
              title="Supporting Statements"
              desc="Fully structured statements built around your job's person specification — every essential and desirable criterion evidenced with real examples from your background."
            />
            <ServiceCard
              icon="🏥"
              title="NHS England & Wales"
              desc="Tailored for NHS Jobs applications. We follow the 12-category framework recruiters expect, with headed sections or flowing prose — whichever the trust prefers."
            />
            <ServiceCard
              icon="🏴󠁧󠁢󠁳󠁣󠁴󠁿"
              title="NHS Scotland"
              desc="Fully compliant with NHS Scotland's application format and values framework, written to match the exact language and priorities of Scottish NHS trusts."
            />
            <ServiceCard
              icon="🇬🇧"
              title="Civil Service"
              desc="STAR-format responses for Civil Service Success Profiles — Behaviours, Strengths, Experience, and Technical competencies, aligned to the Framework."
            />
            <ServiceCard
              icon="🎤"
              title="Interview Prep"
              desc="Structured interview prep packs with likely questions, STAR-framework answers drawn from your background, and guidance on how to present each example."
            />
            <ServiceCard
              icon="⚡"
              title="Fast Turnaround"
              desc="Statements ready within hours, not days. We work around your deadline — same-day delivery available when you need it."
            />
          </div>
        </div>
      </Section>

      {/* ── How it works ── */}
      <Section className="py-20" style={{ backgroundColor: '#f8faff' }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">How it works</h2>
            <p className="text-gray-500 text-base">Three steps from job advert to finished statement.</p>
          </div>

          <div className="flex flex-col gap-8">
            <Step
              number={1}
              title="Send us your job advert"
              desc="Share the job posting link or paste the person specification. Tell us a bit about your background — work history, qualifications, relevant experience."
            />
            <Step
              number={2}
              title="We write your statement"
              desc="Our tool analyses every criterion in the spec and builds a fully evidenced statement using your background. Each criterion is named, matched, and scored."
            />
            <Step
              number={3}
              title="You review and submit"
              desc="You receive a polished, recruiter-ready statement. Review it, request any tweaks, and submit with confidence."
            />
          </div>
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section className="py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-xl mx-auto"
        >
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
            Ready to apply with confidence?
          </h2>
          <p className="text-gray-500 text-base mb-8 leading-relaxed">
            Get in touch and tell us about the role you&apos;re applying for. We&apos;ll take it from there.
          </p>
          <a
            href="mailto:hello@easeme.live"
            className="inline-block px-8 py-4 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-base"
            style={{ backgroundColor: '#005eb8' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#003087' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#005eb8' }}
          >
            Email us: hello@easeme.live
          </a>
          <p className="text-sm text-gray-400 mt-4">
            Or reach us through your preferred channel — we&apos;ll respond quickly.
          </p>
        </motion.div>
      </Section>

      {/* ── Footer ── */}
      <footer
        className="mt-auto py-5 px-6 text-center text-xs text-gray-400 border-t border-gray-100"
        style={{ backgroundColor: '#f8faff' }}
      >
        <p>© {new Date().getFullYear()} EaseMe · Independent writing service · Not affiliated with NHS or UK Civil Service</p>
      </footer>

    </main>
  )
}
