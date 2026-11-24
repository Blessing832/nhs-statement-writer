import { supabaseAdmin } from '@/lib/supabase'

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

// Returns "2026-08-11" for today in UK/London time
function todayUK(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

// Parse "11 August 2026" or ISO dates → "2026-08-11"
function parseDatePosted(raw: string): string | null {
  if (!raw) return null
  const m = raw.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (m) {
    const day = parseInt(m[1])
    const month = MONTHS[m[2].toLowerCase()]
    const year = parseInt(m[3])
    if (month !== undefined) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  // Fallback: try standard date parsing
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

function mapItem(item: Record<string, unknown>, today: string): {
  external_id: string
  title: string
  employer: string
  location: string
  band: string
  contract_type: string
  closing_date: string
  url: string
  date_posted: string
  scrape_date: string
} | null {
  const url = str(item.url || item.jobUrl || item.apply_url || item.link || item.applyUrl)
  const title = str(item.title || item.jobTitle || item.job_title || item.name)
  if (!url && !title) return null

  const external_id = url || str(item.id || item.jobId || item.ref)
  if (!external_id) return null

  // Parse date posted — Apify actor returns it as datePosted / publicationDate / etc.
  const rawDatePosted = str(
    item.datePosted || item.date_posted || item.publicationDate ||
    item.publication_date || item.postedDate || item.posted_date || item.posted
  )
  const date_posted = parseDatePosted(rawDatePosted) ?? ''

  // Only accept vacancies posted today — skip if date is known and doesn't match
  if (date_posted && date_posted !== today) {
    return null
  }

  return {
    external_id,
    title: title || 'NHS Vacancy',
    employer: str(item.employer || item.companyName || item.organisation || item.organization || item.trust || item.company),
    location: str(item.location || item.town || item.city || item.region),
    band: str(item.band || item.payBand || item.pay_band || item.salary || item.salaryRange || item.salary_range),
    contract_type: str(item.contractType || item.contract_type || item.employmentType || item.employment_type),
    closing_date: str(item.closingDate || item.closing_date || item.deadline),
    url: url || `https://jobs.nhs.uk`,
    date_posted,
    scrape_date: today,
  }
}

export interface IngestSummary {
  total: number
  kept: number
  inserted: number
  today: string
  sampleDates: string[]
  error?: string
}

// Keeps today's postings, upserts them, then removes older days. Safe to run twice.
export async function saveVacancies(items: Record<string, unknown>[]): Promise<IngestSummary> {
  const today = todayUK()
  const sampleDates = items.slice(0, 5).map(i => str(i.datePosted || i.date_posted || i.publicationDate || i.postedDate || i.posted) || '(no date field)')
  const base = { total: items.length, kept: 0, inserted: 0, today, sampleDates }
  if (items.length === 0) return base

  const rows = items.map(i => mapItem(i, today)).filter((r): r is NonNullable<typeof r> => r !== null)
  if (rows.length === 0) return base

  const { error } = await supabaseAdmin.from('nhs_vacancies').upsert(rows, { onConflict: 'external_id' })
  if (error) return { ...base, kept: rows.length, error: error.message }

  await supabaseAdmin.from('nhs_vacancies').delete().lt('scrape_date', today)
  return { ...base, kept: rows.length, inserted: rows.length }
}
