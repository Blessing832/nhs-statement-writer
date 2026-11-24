import { verifyAdminToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { triggerApifyScrapeDetailed, fetchApifyRun, fetchApifyDataset } from '@/lib/vacancy-scheduler'
import { saveVacancies } from '@/lib/vacancy-ingest'

const WAIT_MS = 90_000
const POLL_MS = 3_000

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const result = await triggerApifyScrapeDetailed()
  if (!result.runId) {
    return NextResponse.json({ error: result.error ?? 'Failed to trigger the Apify run' }, { status: 502 })
  }

  // Wait for the run and import it here, so a manual scrape never depends on Apify calling back.
  const runId = result.runId
  const deadline = Date.now() + WAIT_MS
  let status = 'RUNNING'
  let datasetId = ''
  let message = ''
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS))
    const run = await fetchApifyRun(runId).catch(() => null)
    if (!run) continue
    status = run.status
    datasetId = run.datasetId
    message = run.message
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) break
  }

  if (status !== 'SUCCEEDED') {
    return NextResponse.json({ ok: true, runId, status, message, finished: false })
  }

  try {
    const items = datasetId ? await fetchApifyDataset(datasetId) : []
    const summary = await saveVacancies(items)
    console.log(`TRIGGER IMPORT: ${summary.total} items, ${summary.kept} posted today (${summary.today}), ${summary.inserted} saved. Sample dates: ${summary.sampleDates.join(' | ')}`)
    return NextResponse.json({ ok: true, runId, status, finished: true, summary })
  } catch (err) {
    return NextResponse.json({ error: `The run finished but the import failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 })
  }
}
