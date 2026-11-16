'use client'
import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'

// Festive season: 15 Nov to 6 Jan. Add ?xmas=off to hide it for a session.
function isFestiveSeason(now = new Date()): boolean {
  const m = now.getMonth()
  const d = now.getDate()
  return (m === 10 && d >= 15) || m === 11 || (m === 0 && d <= 6)
}

function festiveNow(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('xmas')
    if (q === 'off') sessionStorage.setItem('xmas-off', '1')
    if (q === 'on') sessionStorage.removeItem('xmas-off')
    if (sessionStorage.getItem('xmas-off') === '1') return false
  } catch { /* storage unavailable */ }
  return isFestiveSeason()
}

const subscribe = () => () => {}

// Server and first client render see "off", so there is no hydration mismatch.
function useFestive(opts: { snow?: boolean } = {}): boolean {
  const pathname = usePathname()
  const season = useSyncExternalStore(subscribe, festiveNow, () => false)
  // Snow stays off the admin and statement-writing pages so it never sits over text people are reading.
  return season && !(opts.snow && (pathname.startsWith('/admin') || pathname.startsWith('/generate')))
}

const BULB_COLOURS = ['#C8102E', '#F4A800', '#1E9E5A', '#4DA3FF']

export function FestiveGarland() {
  const on = useFestive()
  if (!on) return null
  return (
    <div className="festive-garland" aria-hidden="true">
      {Array.from({ length: 48 }).map((_, i) => (
        <span
          key={i}
          style={{
            backgroundColor: BULB_COLOURS[i % BULB_COLOURS.length],
            color: BULB_COLOURS[i % BULB_COLOURS.length],
            animationDelay: `${(i % 6) * 0.35}s`,
          }}
        />
      ))}
    </div>
  )
}

// Deterministic spread so the component stays pure (no Math.random during render).
const FLAKES = Array.from({ length: 32 }, (_, i) => {
  const r = (n: number) => ((i * 9301 + n * 49297) % 233280) / 233280
  return {
    left: r(1) * 100,
    size: 3 + r(2) * 5,
    dur: 9 + r(3) * 10,
    delay: -r(4) * 18,
    drift: -30 + r(5) * 60,
    op: 0.35 + r(6) * 0.45,
  }
})

export function Snowfall() {
  const on = useFestive({ snow: true })
  if (!on) return null
  return (
    <div className="snowfall" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <i
          key={i}
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.op,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
            ['--drift' as string]: `${f.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

export function FestivePill({ className = '' }: { className?: string }) {
  const on = useFestive()
  if (!on) return null
  return (
    <span className={`festive-pill ${className}`}>
      <span aria-hidden="true">🎄</span> Season&apos;s greetings from EaseMe
    </span>
  )
}
