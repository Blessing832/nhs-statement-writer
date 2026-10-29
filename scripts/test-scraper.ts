/**
 * Before/after comparison of the job scraper's 80-char filter vs V3 person-spec-aware scraper.
 * Usage: npx ts-node scripts/test-scraper.ts <url>
 */
import { scrapeJobUrl } from '../lib/job-scraper'

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: npx ts-node scripts/test-scraper.ts <url>')
    process.exit(1)
  }

  console.log('Scraping:', url)
  const result = await scrapeJobUrl(url)

  console.log('\n=== JOB TITLE ===')
  console.log(result.jobTitle)

  console.log('\n=== ORGANISATION ===')
  console.log(result.organisation)

  console.log('\n=== RAW TEXT (first 3000 chars) ===')
  console.log(result.rawText.slice(0, 3000))

  console.log('\n=== PERSON SPEC ===')
  console.log(result.personSpec.slice(0, 2000))

  console.log('\n=== SOURCE ===')
  console.log(result.source)
}

main().catch(console.error)
