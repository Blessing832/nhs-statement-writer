/**
 * NHS Scotland vacancy scraper.
 *
 * The native NHS Scotland jobs site (apply.jobs.scot.nhs.uk) blocks automated
 * requests with a 403 WAF. We instead use HealthJobsUK, which aggregates NHS
 * Scotland vacancies alongside England/Wales, filtered to the Scotland region.
 */
import type { ScrapedVacancy } from '../types'
import { scrapeHealthJobsUK } from './healthjobsuk'

export async function scrapeNHSScotland(params: {
  keywords: string[]
  locations: string[]
  bands: string[]
  employmentType: string
}): Promise<ScrapedVacancy[]> {
  const results = await scrapeHealthJobsUK({
    ...params,
    regions: ['scotland'],
  })

  // Re-tag source as 'scotland' so per-applicant source filtering still works
  return results.map((v) => ({ ...v, source: 'scotland' as const }))
}

export async function checkScotlandVacancyOpen(vacancyUrl: string): Promise<boolean> {
  // Scotland vacancies now come from HealthJobsUK — delegate to their checker
  const { checkHealthJobsUKVacancyOpen } = await import('./healthjobsuk')
  return checkHealthJobsUKVacancyOpen(vacancyUrl)
}
