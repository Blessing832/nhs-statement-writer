import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchApifyDataset } from '@/lib/vacancy-scheduler'

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function mapItem(item: Record<string, unknown>): {
  external_id: string
  title: string
  employer: string
  location: string
  band: string
  contract_type: string
  closing_date: string
  url: string
} | null {
  const url = str(item.url || item.jobUrl || item.apply_url || item.link || item.applyUrl)
  const title = str(item.title || item.jobTitle || item.job_title || item.name)
  if (!url && !title) return null

  const external_id = url || str(item.id || item.jobId || item.ref)
  if (!external_id) return null

  return {
    external_id,
    title: title || 'NHS Vacancy',
    employer: str(item.employer || item.companyName || item.organisation || item.organization || item.trust || item.company),
    location: str(item.location || item.town || item.city || item.region),
    band: str(item.band || item.payBand || item.pay_band || item.salary || item.salaryRange || item.salary_range),
    contract_type: str(item.contractType || item.contract_type || item.employmentType || item.employment_type),
    closing_date: str(item.closingDate || item.closing_date || item.deadline),
    url: url || `https://jobs.nhs.uk`,
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

  // Apify sends eventType + resource.defaultDatasetId on webhook
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
    // Direct POST of items array (for testing)
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

  const rows = items.map(mapItem).filter((r): r is NonNullable<typeof r> => r !== null)
  console.log(`INGEST: mapped ${rows.length} valid rows from ${items.length} items`)

  if (rows.length === 0) {
    console.warn(`INGEST: ${items.length} items received but none mapped (check field names)`)
    return NextResponse.json({ ok: true, inserted: 0, warning: 'no mappable items' })
  }

  const { error } = await supabaseAdmin
    .from('nhs_vacancies')
    .upsert(rows, { onConflict: 'external_id' })

  if (error) {
    console.error('INGEST: Supabase upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Purge rows older than 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await supabaseAdmin.from('nhs_vacancies').delete().lt('scraped_at', cutoff)

  console.log(`INGEST COMPLETE: upserted ${rows.length} vacancies (from ${items.length} items)`)
  return NextResponse.json({ ok: true, inserted: rows.length })
}
