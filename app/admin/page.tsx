'use client'
import Link from 'next/link'
import { useAdminToken } from '@/lib/admin-context'

const SECTIONS = [
  {
    href: '/admin/candidates',
    label: 'Candidate Log',
    description: 'Manage applicant profiles, subscriptions, and vacancy alert settings',
    icon: '👥',
    color: '#005eb8',
    stats: null,
  },
  {
    href: '/admin/vacancies',
    label: 'Vacancies',
    description: 'Monitor live NHS, Scotland, Civil Service and HealthJobsUK job alerts',
    icon: '🔍',
    color: '#003087',
    stats: null,
  },
  {
    href: '/admin/statements',
    label: 'Statements',
    description: 'View all generated supporting statements and applicant activity',
    icon: '📄',
    color: '#009639',
    stats: null,
  },
]

export default function AdminHub() {
  const { onLogout } = useAdminToken()

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
        <p className="text-gray-500 text-sm">Choose a section to manage</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-blue-600 hover:shadow-md transition-all flex flex-col gap-3"
            style={{ '--hover-color': section.color } as React.CSSProperties}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${section.color}18` }}
            >
              {section.icon}
            </div>
            <div>
              <h3
                className="font-bold text-lg text-gray-900 group-hover:text-blue-700 mb-1"
              >
                {section.label}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{section.description}</p>
            </div>
            <div
              className="mt-auto text-xs font-semibold flex items-center gap-1"
              style={{ color: section.color }}
            >
              Open <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={onLogout}
          className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
