const ACTOR_ID = 'kinaesthetic_millionaire~nhs-uk-jobs-scraper'
const APIFY_BASE = 'https://api.apify.com/v2'
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://easeme.live'}/api/vacancies/ingest`

export async function triggerApifyScrape(): Promise<string | null> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    console.error('VACANCY_SCHEDULER: APIFY_API_TOKEN not set, skipping scrape')
    return null
  }

  const res = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(ACTOR_ID)}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhooks: [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED'],
            requestUrl: WEBHOOK_URL,
          },
        ],
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    console.error(`VACANCY_SCHEDULER: Apify trigger failed ${res.status} — ${body.slice(0, 200)}`)
    return null
  }

  const json = await res.json()
  const runId: string = json?.data?.id ?? 'unknown'
  console.log(`VACANCY_SCHEDULER: Apify run started — runId=${runId}`)
  return runId
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
