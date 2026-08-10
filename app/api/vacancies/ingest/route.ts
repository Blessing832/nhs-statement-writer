import { NextRequest, NextResponse } from 'next/server'
import { insertVacancy } from '@/lib/vacancies-db'

// Apify sends results here after each scraper run.
// Set up in Apify: Integrations -> Webhook -> URL: https://easeme.live/api/vacancies/ingest
// Event: Actor run succeeded

export const runtime = 'nodejs'

function extractReference(url: string): string | null {
  // NHS Jobs URL format: /candidate/jobadvert/C9234-26-0704
  const match = url.match(/\/jobadvert\/([A-Z0-9]+-[\d]+-[\d]+)/i)
  return match ? match[1].toUpperCase() : null
}

function todayUK(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

function isToday(dateStr: string | undefined): boolean {
  if (!dateStr) return true // if no date, accept it
  return dateStr.slice(0, 10) === todayUK()
}

type RawItem = Record<string, string | undefined>

export async function POST(req: NextRequest) {
  let body: { items?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const items: RawItem[] = Array.isArray(body.items) ? (body.items as RawItem[]) : []
  let inserted = 0
  let skipped = 0

  for (const item of items) {
    const url = item.url ?? ''
    if (!url) { skipped++; continue }

    const reference = extractReference(url)
    if (!reference) { skipped++; continue }

    // Drop anything not from today (UK time)
    if (!isToday(item.datePosted)) { skipped++; continue }

    const staffGroup = url.includes('NURSING_AND_MIDWIFERY_REGD') ? 'nursing' : 'allied'

    try {
      insertVacancy({
        reference,
        title: item.title ?? 'Untitled',
        companyName: item.companyName ?? '',
        location: item.location ?? '',
        salary: item.salary ?? '',
        closingDate: item.closingDate ?? '',
        url,
        staffGroup,
        datePosted: item.datePosted ?? todayUK(),
      })
      inserted++
    } catch {
      skipped++
    }
  }

  console.log(`[vacancies/ingest] inserted=${inserted} skipped=${skipped} total=${items.length}`)
  return NextResponse.json({ inserted, skipped })
}
