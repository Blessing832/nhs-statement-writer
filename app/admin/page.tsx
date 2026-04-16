'use client'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { useAdminToken } from '@/lib/admin-context'

const SECTIONS = [
  {
    href: '/admin/candidates',
    label: 'Candidate Log',
    description: 'Manage applicant profiles, subscriptions, and vacancy alert settings',
    icon: '👥',
    color: '#005eb8',
  },
  {
    href: '/admin/vacancies',
    label: 'Vacancies',
    description: 'Monitor live NHS England and HealthJobsUK job alerts for all applicants',
    icon: '🔍',
    color: '#003087',
  },
  {
    href: '/admin/statements',
    label: 'Statements',
    description: 'View all generated supporting statements and applicant activity',
    icon: '📄',
    color: '#009639',
  },
  {
    href: '/admin/quick-write',
    label: 'Quick Write',
    description: 'One-time statement for a guest — paste their history and job link, get a statement instantly',
    icon: '⚡',
    color: '#7c3aed',
  },
  {
    href: '/admin/interview-prep',
    label: 'Interview Prep',
    description: 'Generate a full interview preparation pack — person spec, 20 Q&As, STARR answers, and tips',
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

export default function AdminHub() {
  const { onLogout } = useAdminToken()

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
          style={{ backgroundColor: '#003087' }}
        >
          <span className="text-white font-bold text-base">NHS</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
        <p className="text-gray-400 text-sm">Choose a section to manage</p>
      </motion.div>

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
