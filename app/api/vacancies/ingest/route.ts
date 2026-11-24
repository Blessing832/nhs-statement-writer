import { NextRequest, NextResponse } from 'next/server'
import { fetchApifyDataset } from '@/lib/vacancy-scheduler'
import { saveVacancies } from '@/lib/vacancy-ingest'

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

  const str = (v: unknown) => (v == null ? '' : String(v).trim())
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

  const summary = await saveVacancies(items)
  console.log(`INGEST: ${summary.total} items, ${summary.kept} posted today (${summary.today}), ${summary.inserted} saved. Sample dates: ${summary.sampleDates.join(' | ')}`)
  if (summary.error) {
    console.error('INGEST: Supabase upsert error:', summary.error)
    return NextResponse.json({ error: summary.error }, { status: 500 })
  }
  if (summary.kept === 0) {
    return NextResponse.json({ ok: true, inserted: 0, warning: 'no items posted today' })
  }
  return NextResponse.json({ ok: true, inserted: summary.inserted })
}
