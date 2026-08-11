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

// 10:30am, 12:30pm, 2:30pm UK time
cron.schedule('30 10,12,14 * * *', runScrape, { timezone: 'Europe/London' })
// 4:00pm UK time
cron.schedule('0 16 * * *', runScrape, { timezone: 'Europe/London' })

console.log('VACANCY_CRON: scheduler started (10:30am / 12:30pm / 2:30pm / 4pm London)')
