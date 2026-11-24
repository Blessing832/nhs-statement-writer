// Apify saved task — has the correct NHS Jobs URL and pay band filters pre-configured
const TASK_ID = 'deola1122~nhs-uk-jobs-scraper-task'
const APIFY_BASE = 'https://api.apify.com/v2'
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://easeme.live'}/api/vacancies/ingest`

export interface ScrapeTriggerResult {
  runId: string | null
  error?: string
}

export async function triggerApifyScrape(): Promise<string | null> {
  return (await triggerApifyScrapeDetailed()).runId
}

// Same as triggerApifyScrape but says why it failed, so the admin screen can show the reason.
export async function triggerApifyScrapeDetailed(): Promise<ScrapeTriggerResult> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    console.error('VACANCY_SCHEDULER: APIFY_API_TOKEN not set, skipping scrape')
    return { runId: null, error: 'APIFY_API_TOKEN is not set on the server' }
  }

  // Apify requires webhooks as a URL-safe base64-encoded query param, not in the body.
  const webhooksParam = Buffer.from(
    JSON.stringify([{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: WEBHOOK_URL }])
  ).toString('base64url')

  // Trigger the saved task (uses task's pre-configured input — URL, pay bands, max items)
  let res: Response
  try {
    res = await fetch(
      `${APIFY_BASE}/actor-tasks/${TASK_ID}/runs?token=${token}&webhooks=${webhooksParam}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`VACANCY_SCHEDULER: could not reach Apify — ${message}`)
    return { runId: null, error: `Could not reach Apify: ${message}` }
  }

  if (!res.ok) {
    const body = await res.text()
    console.error(`VACANCY_SCHEDULER: Apify trigger failed ${res.status} — ${body.slice(0, 300)}`)
    return { runId: null, error: `Apify refused the run (HTTP ${res.status}): ${body.slice(0, 200)}` }
  }

  const json = await res.json()
  const runId: string = json?.data?.id ?? 'unknown'
  console.log(`VACANCY_SCHEDULER: Apify run started — runId=${runId}`)
  return { runId }
}

export async function fetchApifyDataset(datasetId: string): Promise<Record<string, unknown>[]> {
  const token = process.env.APIFY_API_TOKEN
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?format=json&token=${token}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`)
  return res.json()
}
