'use client'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useAdminToken } from '@/lib/admin-context'

const SECTIONS = [
  {
    href: '/admin/candidates',
    label: 'Candidate Log',
    description: 'Manage applicant profiles, subscriptions, and vacancy alert settings',
    icon: '👥',
    color: '#0B4F6C',
  },
  {
    href: '/admin/bulk-instructions',
    label: 'Bulk Instructions',
    description: 'Set unique writing tone and focus instructions for all candidates on one page',
    icon: '✍️',
    color: '#0891b2',
  },
  {
    href: '/admin/vacancies',
    label: 'Vacancies',
    description: 'Monitor live NHS England and HealthJobsUK job alerts for all applicants',
    icon: '🔍',
    color: '#072f42',
  },
  {
    href: '/admin/statements',
    label: 'Statements',
    description: 'View all generated supporting statements and applicant activity',
    icon: '📄',
    color: '#009639',
  },
  {
    href: '/admin/generate',
    label: 'Generate by Applicant',
    description: 'Search for an applicant by name or code, then generate their statement with the full interface',
    icon: '✍️',
    color: '#0891b2',
  },
  {
    href: '/admin/quick-write',
    label: 'Quick Write',
    description: 'One-time statement for a guest: paste their history and job link, get a statement instantly',
    icon: '⚡',
    color: '#7c3aed',
  },
  {
    href: '/admin/interview-prep',
    label: 'Interview Prep',
    description: 'Generate a full interview preparation pack: person spec, 20 Q&As, STARR answers, and tips',
    icon: '🎯',
    color: '#dc2626',
  },
]

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const card: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
}

interface ErrorSummary { count: number; recent: { id: string; created_at: string; client_code: string; error_type: string }[] }

export default function AdminHub() {
  const { token, onLogout } = useAdminToken()
  const [errors, setErrors] = useState<ErrorSummary | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/generate-errors', { headers: { 'x-admin-token': token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setErrors(d) })
      .catch(() => {})
  }, [token])

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-10"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md"
          style={{ backgroundColor: '#072f42' }}
        >
          <span className="text-white font-bold text-base">NHS</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
        <p className="text-gray-400 text-sm">Choose a section to manage</p>
      </motion.div>

      {errors && errors.count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-red-700">
            ⚠ {errors.count} generate {errors.count === 1 ? 'failure' : 'failures'} in the last 24 hours
          </p>
          <div className="mt-2 space-y-1">
            {errors.recent.slice(0, 5).map(e => (
              <p key={e.id} className="text-xs text-red-600">
                {new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                {' · '}{e.client_code || 'unknown'}
                {' · '}<span className="font-medium">{e.error_type}</span>
              </p>
            ))}
            {errors.count > 5 && (
              <p className="text-xs text-red-400">…and {errors.count - 5} more</p>
            )}
          </div>
        </motion.div>
      )}

      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {SECTIONS.map((section) => (
          <motion.div key={section.href} variants={card}>
            <Link
              href={section.href}
              className="group bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all flex flex-col gap-3 relative overflow-hidden"
            >
              {/* Subtle color accent on hover */}
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: section.color }}
              />

              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                style={{ backgroundColor: `${section.color}18` }}
              >
                {section.icon}
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-700 mb-1 transition-colors">
                  {section.label}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">{section.description}</p>
              </div>
              <div
                className="mt-auto text-xs font-semibold flex items-center gap-1 transition-transform"
                style={{ color: section.color }}
              >
                Open
                <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-10 text-center"
      >
        <button
          onClick={onLogout}
          className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
        >
          Sign out
        </button>
      </motion.div>
    </div>
  )
}
