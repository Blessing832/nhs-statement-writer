import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchApifyDataset } from '@/lib/vacancy-scheduler'

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

export async function POST(req: NextRequest) {
  console.log('INGEST START: webhook received')

  let payload: Record<string, unknown>
  try {
    const raw = await req.text()
    console.log('INGEST RAW BODY:', raw.slice(0, 1000))
    payload = JSON.parse(raw)
  } catch {
    console.error('INGEST ERROR: invalid JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = str(payload.eventType)
  console.log(`INGEST eventType=${eventType || '(none)'}`)
  if (eventType && eventType !== 'ACTOR.RUN.SUCCEEDED') {
    console.log(`INGEST: skipping event type ${eventType}`)
    return NextResponse.json({ ok: true, skipped: true })
  }

  const resource = payload.resource as Record<string, unknown> | undefined
  const datasetId = str(resource?.defaultDatasetId)
  console.log(`INGEST datasetId=${datasetId || '(none)'}`)

  let items: Record<string, unknown>[] = []
  if (datasetId) {
    try {
      items = await fetchApifyDataset(datasetId)
      console.log(`INGEST: fetched ${items.length} items from dataset ${datasetId}`)
      if (items.length > 0) {
        console.log('INGEST SAMPLE ITEM keys:', Object.keys(items[0]).join(', '))
        console.log('INGEST SAMPLE ITEM:', JSON.stringify(items[0]).slice(0, 500))
      }
    } catch (err) {
      console.error('INGEST: dataset fetch failed:', err)
      return NextResponse.json({ error: 'Dataset fetch failed' }, { status: 502 })
    }
  } else {
    if (Array.isArray(payload)) {
      items = payload as Record<string, unknown>[]
    } else if (Array.isArray(payload.items)) {
      items = payload.items as Record<string, unknown>[]
    }
    console.log(`INGEST: direct POST with ${items.length} items`)
  }

  if (items.length === 0) {
    console.log('INGEST: no items in payload, returning early')
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const today = todayUK()
  const rows = items.map(i => mapItem(i, today)).filter((r): r is NonNullable<typeof r> => r !== null)
  console.log(`INGEST: mapped ${rows.length} valid rows (today's postings) from ${items.length} items`)

  if (rows.length === 0) {
    console.warn(`INGEST: 0 rows kept — all ${items.length} items were filtered out (not posted today or unmappable)`)
    return NextResponse.json({ ok: true, inserted: 0, warning: 'no items posted today' })
  }

  const { error } = await supabaseAdmin
    .from('nhs_vacancies')
    .upsert(rows, { onConflict: 'external_id' })

  if (error) {
    console.error('INGEST: Supabase upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Purge all rows from previous days
  await supabaseAdmin.from('nhs_vacancies').delete().lt('scrape_date', today)

  console.log(`INGEST COMPLETE: upserted ${rows.length} vacancies (scrape_date=${today})`)
  return NextResponse.json({ ok: true, inserted: rows.length })
}
