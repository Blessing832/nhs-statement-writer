import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedVacancy } from '../types'

const BASE_URL = 'https://www.healthjobsuk.com'
const SEARCH_URL = `${BASE_URL}/job_list`

// HealthJobsUK region parameter values
const REGION_ENGLAND = 'JobSearch_re_0=1'
const REGION_SCOTLAND = 'JobSearch_re_1=1-_-_-'
const REGION_WALES = 'JobSearch_re_2=1-_-_--_-_-'

function buildSearchUrl(params: {
  keywords: string[]
  locations: string[]
  regions?: ('england' | 'scotland' | 'wales')[]
}): string {
  const searchParams = new URLSearchParams()

  if (params.keywords.length > 0) {
    searchParams.set('JobSearch_q', params.keywords.join(' '))
  } else {
    searchParams.set('JobSearch_q', '')
  }

  // Discipline (empty = all disciplines)
  searchParams.set('JobSearch_d', '')

  // Healthcare group filter — 303 = Healthcare sector (filters to NHS/health employers)
  searchParams.set('JobSearch_g', '303')

  // Required by the form
  searchParams.set('JobSearch_re', '_POST')
  searchParams.set('JobSearch_Submit', 'Search')

  let url = `${SEARCH_URL}?${searchParams.toString()}`

  // Append region params (they share the same key name pattern, so can't use URLSearchParams)
  const regions = params.regions ?? ['england', 'scotland', 'wales']
  if (regions.includes('england')) url += `&${REGION_ENGLAND}`
  if (regions.includes('scotland')) url += `&${REGION_SCOTLAND}`
  if (regions.includes('wales')) url += `&${REGION_WALES}`

  return url
}

function parseHJDate(text: string): string | null {
  if (!text) return null
  const cleaned = text
    .replace(/closes?[:\s]*/i, '')
    .replace(/posted[:\s]*/i, '')
    .replace(/closing date[:\s]*/i, '')
    .replace(/date posted[:\s]*/i, '')
    .trim()
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) return date.toISOString()
  // Relative: "2 days ago"
  const daysAgo = cleaned.match(/(\d+)\s+days?\s+ago/i)
  if (daysAgo) {
    const d = new Date()
    d.setDate(d.getDate() - parseInt(daysAgo[1]))
    return d.toISOString()
  }
  const hoursAgo = cleaned.match(/(\d+)\s+hours?\s+ago/i)
  if (hoursAgo) {
    const d = new Date()
    d.setHours(d.getHours() - parseInt(hoursAgo[1]))
    return d.toISOString()
  }
  return null
}

/**
 * Extract a job ID from a HealthJobsUK URL.
 * Handles paths like /job/UK12345/title or /job_list?id=12345 etc.
 */
function extractJobId(href: string): string {
  const patterns = [
    /\/job\/([A-Za-z0-9_-]+)/,
    /\/jobs\/([A-Za-z0-9_-]+)/,
    /[\?&]id=([A-Za-z0-9_-]+)/,
    /[\?&]jobid=([A-Za-z0-9_-]+)/i,
    /\/(\d{4,})/,
  ]
  for (const p of patterns) {
    const m = href.match(p)
    if (m) return m[1]
  }
  return Buffer.from(href).toString('base64').slice(0, 20)
}

export async function scrapeHealthJobsUK(params: {
  keywords: string[]
  locations: string[]
  bands: string[]
  employmentType: string
  regions?: ('england' | 'scotland' | 'wales')[]
}): Promise<ScrapedVacancy[]> {
  const url = buildSearchUrl(params)
  const results: ScrapedVacancy[] = []

  try {
    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        Referer: BASE_URL,
      },
    })

    const $ = cheerio.load(response.data)

    // --- Strategy 1: known HealthJobsUK CSS class patterns ---
    // The site has historically used multiple class naming conventions across rebuilds
    const JOB_CARD_SELECTORS = [
      '.HJV_jobListItem',
      '.vjl-results-item',
      '.job-item',
      '.job-listing',
      '.job-result',
      '.vacancy-item',
      '.vacancy-result',
      'article.job',
      'li.result-item',
      '.search-result-item',
      '[class*="jobListItem"]',
      '[class*="job-list-item"]',
      '[class*="vacancy-item"]',
    ].join(', ')

    let jobCards = $(JOB_CARD_SELECTORS).toArray()

    // --- Strategy 2: anchor-based discovery ---
    // Find all links that look like job detail pages and use their parent container
    if (jobCards.length === 0) {
      const jobLinks = $('a[href*="/job/"], a[href*="/jobs/"]').toArray()
      // Deduplicate by href
      const seen = new Set<string>()
      for (const link of jobLinks) {
        const href = $(link).attr('href') || ''
        if (!href || seen.has(href)) continue
        seen.add(href)

        const title = $(link).text().trim()
        if (!title || title.length < 3) continue

        const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
        const externalId = `hjuk-${extractJobId(href)}`

        // Walk up to find a container with org/location info
        const $container = $(link).closest('li, article, div.job, div.vacancy, tr, [class*="item"], [class*="result"]')

        const orgText = $container
          .find('[class*="employer"], [class*="organisation"], [class*="trust"], [class*="company"]')
          .first()
          .text()
          .trim()

        const locText = $container
          .find('[class*="location"], [class*="Location"]')
          .first()
          .text()
          .trim()

        const bandText = $container
          .find('[class*="salary"], [class*="band"], [class*="Band"], [class*="grade"]')
          .first()
          .text()
          .trim()

        const empTypeText = $container
          .find('[class*="contract"], [class*="type"], [class*="hours"], [class*="pattern"]')
          .first()
          .text()
          .trim()

        const closingText = $container
          .find('[class*="closing"], [class*="Closing"], [class*="expire"], [class*="close"]')
          .first()
          .text()
          .trim()

        const postedText = $container
          .find('[class*="posted"], [class*="Posted"], [class*="date"]')
          .first()
          .text()
          .trim()

        results.push({
          external_id: externalId,
          source: 'healthjobsuk',
          title,
          organisation: orgText,
          location: locText,
          band: bandText,
          employment_type: empTypeText,
          url: jobUrl,
          posted_at: parseHJDate(postedText),
          closes_at: parseHJDate(closingText),
        })
      }
    }

    // --- Strategy 3: JSON-LD structured data ---
    if (results.length === 0) {
      $('script[type="application/ld+json"]').toArray().forEach((el) => {
        try {
          const raw = $(el).html() || ''
          const data = JSON.parse(raw)
          const items: unknown[] = Array.isArray(data) ? data : (data['@graph'] || [data])
          for (const item of items) {
            if (typeof item !== 'object' || item === null) continue
            const job = item as Record<string, unknown>
            if (job['@type'] !== 'JobPosting') continue
            const id = String(
              (job.identifier as Record<string, unknown>)?.value ||
              String(job.url || '').split('/').pop() ||
              ''
            )
            if (!id) continue
            results.push({
              external_id: `hjuk-${id}`,
              source: 'healthjobsuk',
              title: String(job.title || 'Unknown'),
              organisation: String((job.hiringOrganization as Record<string, unknown>)?.name || ''),
              location: String(
                (job.jobLocation as Record<string, unknown>)?.address
                  ? ((job.jobLocation as Record<string, unknown>).address as Record<string, unknown>)?.addressLocality || ''
                  : ''
              ),
              band: String((job.baseSalary as Record<string, unknown>)?.value
                ? ((job.baseSalary as Record<string, unknown>).value as Record<string, unknown>)?.description || ''
                : ''),
              employment_type: String(job.employmentType || ''),
              url: String(job.url || url),
              posted_at: job.datePosted ? new Date(String(job.datePosted)).toISOString() : null,
              closes_at: job.validThrough ? new Date(String(job.validThrough)).toISOString() : null,
            })
          }
        } catch {
          // ignore parse errors
        }
      })
    }

    // --- Process card-based results (Strategy 1) ---
    for (const card of jobCards) {
      const $card = $(card)

      const titleEl = $card
        .find([
          'h2 a', 'h3 a', 'h4 a',
          '.HJV_jobTitle a', '.job-title a', '.vacancy-title a',
          '[class*="jobTitle"] a', '[class*="job-title"] a',
          'a.title', 'a.job-title',
        ].join(', '))
        .first()

      const title = titleEl.text().trim() || $card.find('a').first().text().trim()
      const href = titleEl.attr('href') || $card.find('a').first().attr('href') || ''
      if (!title || !href) continue

      const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
      const externalId = `hjuk-${extractJobId(href)}`

      const organisation = $card
        .find([
          '.HJV_Employer', '.employer', '.company', '.organisation', '.trust',
          '[class*="employer"]', '[class*="organisation"]', '[class*="trust"]',
        ].join(', '))
        .first()
        .text()
        .trim()

      const location = $card
        .find([
          '.HJV_location', '.location', '[class*="location"]',
        ].join(', '))
        .first()
        .text()
        .trim()

      const band = $card
        .find([
          '.HJV_Band', '.salary', '.band', '.grade',
          '[class*="salary"]', '[class*="band"]', '[class*="grade"]',
        ].join(', '))
        .first()
        .text()
        .trim()

      const empType = $card
        .find([
          '.HJV_ContractType', '.job-type', '.contract', '.hours',
          '[class*="contract"]', '[class*="type"]', '[class*="hours"]', '[class*="pattern"]',
        ].join(', '))
        .first()
        .text()
        .trim()

      const closingText = $card
        .find([
          '.HJV_ClosingDate', '.closing-date', '.close-date', '.expires',
          '[class*="closing"]', '[class*="expire"]',
        ].join(', '))
        .first()
        .text()
        .trim()

      const postedText = $card
        .find([
          '.HJV_PostedDate', '.posted', '.date-posted',
          '[class*="posted"]', '[class*="date"]',
        ].join(', '))
        .first()
        .text()
        .trim()

      results.push({
        external_id: externalId,
        source: 'healthjobsuk',
        title,
        organisation,
        location,
        band,
        employment_type: empType,
        url: jobUrl,
        posted_at: parseHJDate(postedText),
        closes_at: parseHJDate(closingText),
      })
    }
  } catch (err) {
    console.error('[healthjobsuk scraper] Error:', err instanceof Error ? err.message : err)
  }

  // Deduplicate by external_id
  const seen = new Set<string>()
  return results.filter((r) => {
    if (seen.has(r.external_id)) return false
    seen.add(r.external_id)
    return true
  })
}

export async function checkHealthJobsUKVacancyOpen(vacancyUrl: string): Promise<boolean> {
  try {
    const response = await axios.get(vacancyUrl, {
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const $ = cheerio.load(response.data)
    const pageText = $.text().toLowerCase()

    const closedSignals = [
      'vacancy closed',
      'job closed',
      'no longer available',
      'applications closed',
      'this position has been filled',
      'expired',
      'this vacancy has now closed',
      'closed for applications',
    ]
    return !closedSignals.some((s) => pageText.includes(s))
  } catch {
    return true
  }
}
