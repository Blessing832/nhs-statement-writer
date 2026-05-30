'use client'

import { CriterionScore } from '@/lib/types'

function pctColor(pct: number): string {
  if (pct >= 100) return '#2563eb' // blue — exceptional / over 100%
  if (pct >= 85) return '#16a34a'  // green — strong
  if (pct >= 60) return '#d97706'  // amber — partial (evidence, no outcome)
  return '#dc2626'                  // red — weak / absent
}

function pctIcon(pct: number): string {
  if (pct >= 100) return '✓✓'
  if (pct >= 60) return '✓'
  return '✗'
}

function overallLabel(pct: number): string {
  if (pct >= 90) return 'Excellent'
  if (pct >= 75) return 'Strong'
  if (pct >= 55) return 'Partial'
  return 'Needs work'
}

function CriterionRow({ s }: { s: CriterionScore }) {
  const color = pctColor(s.pct)
  return (
    <div className="px-3 py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold mt-0.5 w-5 flex-shrink-0 text-center leading-none" style={{ color }}>
          {pctIcon(s.pct)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-gray-700 leading-snug">{s.criterion}</p>
            <span className="text-xs font-bold flex-shrink-0 ml-1" style={{ color }}>{s.pct}%</span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-1 rounded-full transition-all"
              style={{ width: `${Math.min(s.pct, 100)}%`, backgroundColor: color }}
            />
          </div>
          {s.note && (
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">{s.note}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function ScoringMatrix({ scores, overallPct }: { scores: CriterionScore[]; overallPct: number }) {
  const color = pctColor(overallPct)
  const essential = scores.filter((s) => s.type === 'essential')
  const desirable = scores.filter((s) => s.type === 'desirable')

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
      {/* Header — overall score */}
      <div className="px-3 py-2.5 bg-gray-50 flex items-center justify-between border-b border-gray-200">
        <span className="font-semibold text-gray-600 uppercase tracking-wide text-xs">Coverage Score</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">{overallLabel(overallPct)}</span>
          <span className="text-2xl font-bold leading-none" style={{ color }}>{overallPct}%</span>
        </div>
      </div>

      {/* Easeme legend */}
      <div className="px-3 py-1.5 border-b border-gray-100 flex flex-wrap gap-x-3 gap-y-1 bg-white">
        <span className="text-gray-400 text-xs">Scale:</span>
        {[
          { pct: 0,   label: '0% absent' },
          { pct: 25,  label: '25% mentioned' },
          { pct: 60,  label: '60% evidenced' },
          { pct: 100, label: '100% + outcome' },
          { pct: 115, label: '115%+ exceptional' },
        ].map(({ pct, label }) => (
          <span key={pct} className="text-xs" style={{ color: pctColor(pct) }}>{label}</span>
        ))}
      </div>

      {/* Essential criteria */}
      {essential.length > 0 && (
        <>
          <div className="px-3 py-1.5 bg-red-50 border-y border-gray-100">
            <span className="text-xs font-semibold text-red-700">Essential ({essential.length})</span>
          </div>
          {essential.map((s, i) => <CriterionRow key={i} s={s} />)}
        </>
      )}

      {/* Desirable criteria */}
      {desirable.length > 0 && (
        <>
          <div className="px-3 py-1.5 bg-blue-50 border-y border-gray-100">
            <span className="text-xs font-semibold text-blue-700">Desirable ({desirable.length})</span>
          </div>
          {desirable.map((s, i) => <CriterionRow key={i} s={s} />)}
        </>
      )}
    </div>
  )
}
