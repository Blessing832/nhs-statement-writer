import cron from 'node-cron'
import { triggerApifyScrape } from './lib/vacancy-scheduler'

async function runScrape() {
  console.log('VACANCY_CRON: triggering Apify NHS scrape')
  try {
    await triggerApifyScrape()
  } catch (err) {
    console.error('VACANCY_CRON: trigger failed:', err)
  }
}

// 7am, 12pm, 5pm UK time — picks up morning posts, lunchtime, end-of-day
cron.schedule('0 7,12,17 * * *', runScrape, { timezone: 'Europe/London' })

console.log('VACANCY_CRON: scheduler started (7am / 12pm / 5pm London)')
