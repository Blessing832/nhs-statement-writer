import cron from 'node-cron'
import { resetVacancies } from './vacancies-db'

let started = false

function todayUK(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }) // YYYY-MM-DD
}

async function triggerApifyScraper() {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    console.error('[vacancies] APIFY_API_TOKEN not set — skipping run')
    return
  }

  const today = todayUK()
  const body = {
    startUrls: [
      {
        url: `https://www.jobs.nhs.uk/candidate/search/results?payBand=BAND_3%2CBAND_4&workingPattern=full-time&contractType=Permanent&staffGroup=NURSING_AND_MIDWIFERY_REGD&searchFormType=sortBy&sort=publicationDateDesc&language=en&publishedFrom=${today}`,
      },
      {
        url: `https://www.jobs.nhs.uk/candidate/search/results?payBand=BAND_3%2CBAND_4&workingPattern=full-time&contractType=Permanent&staffGroup=ALLIED_HEALTH_PROF&searchFormType=sortBy&sort=publicationDateDesc&language=en&publishedFrom=${today}`,
      },
    ],
    maxItems: 50,
  }

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/kinaesthetic_millionaire~nhs-uk-jobs-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json() as { data?: { id: string } }
    console.log(`[vacancies] Apify run started: ${data.data?.id ?? 'unknown'} (date=${today})`)
  } catch (err) {
    console.error('[vacancies] Failed to trigger Apify scraper:', err)
  }
}

export function startVacancyScheduler() {
  if (started) return
  started = true

  const opts = { timezone: 'Europe/London' }

  // Trigger Apify scraper 4x on weekdays (UK time)
  cron.schedule('30 10 * * 1-5', triggerApifyScraper, opts)
  cron.schedule('0 12 * * 1-5',  triggerApifyScraper, opts)
  cron.schedule('0 14 * * 1-5',  triggerApifyScraper, opts)
  cron.schedule('0 16 * * 1-5',  triggerApifyScraper, opts)

  // Midnight reset — wipe vacancies so each day starts fresh
  cron.schedule('0 0 * * *', () => {
    resetVacancies()
    console.log('[vacancies] Midnight reset: table cleared')
  }, opts)

  console.log('[vacancies] Scheduler started — 4xdaily Mon-Fri + midnight reset (Europe/London)')
}
