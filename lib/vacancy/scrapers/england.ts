import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedVacancy } from '../types'

const BASE_URL = 'https://www.jobs.nhs.uk'
const SEARCH_URL = `${BASE_URL}/candidate/search/results`

const BAND_PARAM_MAP: Record<string, string> = {
  '2': 'BAND_2', 'band 2': 'BAND_2',
  '3': 'BAND_3', 'band 3': 'BAND_3',
  '4': 'BAND_4', 'band 4': 'BAND_4',
  '5': 'BAND_5', 'band 5': 'BAND_5',
  '6': 'BAND_6', 'band 6': 'BAND_6',
  '7': 'BAND_7', 'band 7': 'BAND_7',
  '8a': 'BAND_8A', 'band 8a': 'BAND_8A',
  '8b': 'BAND_8B', 'band 8b': 'BAND_8B',
  '8c': 'BAND_8C', 'band 8c': 'BAND_8C',
  '8d': 'BAND_8D', 'band 8d': 'BAND_8D',
  '9': 'BAND_9', 'band 9': 'BAND_9',
}

export interface EnglandScrapeParams {
  /** NHS pay bands to include (e.g. ['3', '4']) */
  bands?: string[]
  /** Filter by contract type — drives reliable employment_type tagging */
  contractType?: 'Permanent' | 'Fixed-term' | 'Bank'
  /** Filter by working pattern — drives reliable employment_type tagging */
  workingPattern?: 'full-time' | 'part-time'
  /** NHS staff group codes (e.g. ['CLINICAL_SERVICES', 'ALLIED_HEALTH_PROF']) */
  staffGroups?: string[]
  /** How many result pages to fetch (default: 2) */
  pages?: number
}

function buildSearchUrl(params: EnglandScrapeParams & { page?: number }): string {
  const searchParams = new URLSearchParams()

  // Pay bands
  if (params.bands && params.bands.length > 0) {
    const bandParams = params.bands
      .map((b) => BAND_PARAM_MAP[b.toLowerCase()])
      .filter(Boolean)
    if (bandParams.length > 0) {
      searchParams.set('payBand', bandParams.join(','))
    }
  }

  // Contract type (Permanent / Fixed-term / Bank)
  if (params.contractType) {
    searchParams.set('contractType', params.contractType)
  }

  // Working pattern (full-time / part-time)
  if (params.workingPattern) {
    searchParams.set('workingPattern', params.workingPattern)
  }

  // Staff groups (CLINICAL_SERVICES / ALLIED_HEALTH_PROF / NURSING_AND_MIDWIFERY_REGD etc.)
  if (params.staffGroups && params.staffGroups.length > 0) {
    searchParams.set('staffGroup', params.staffGroups.join(','))
  }

  // Pagination
  if (params.page && params.page > 1) {
    searchParams.set('page', String(params.page))
  }

  // Always sort by newest first
  searchParams.set('sort', 'publicationDateDesc')
  searchParams.set('searchFormType', 'sortBy')
  searchParams.set('language', 'en')

  return `${SEARCH_URL}?${searchParams.toString()}`
}

/**
 * Derive a reliable employment_type string from URL params.
 * This avoids relying on HTML parsing which is often empty or inconsistent.
 */
function deriveEmploymentType(params: EnglandScrapeParams): string {
  const parts: string[] = []
  if (params.contractType) parts.push(params.contractType)
  if (params.workingPattern) parts.push(params.workingPattern)
  return parts.join(' ')
}

function parseDate(text: string, prefixPattern?: RegExp): string | null {
  if (!text) return null
  let cleaned = text
  if (prefixPattern) cleaned = cleaned.replace(prefixPattern, '')
  cleaned = cleaned.trim()
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) return date.toISOString()
  return null
}

async function scrapePage(url: string, derivedEmpType: string): Promise<ScrapedVacancy[]> {
  const results: ScrapedVacancy[] = []

  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  })

  const $ = cheerio.load(response.data)

  // NHS Jobs uses various card structures — try multiple selectors
  const jobCards = $(
    '[data-test="search-result"], .job-card, article.vacancy, li.vacancy-item, .nhsuk-card'
  ).toArray()

  if (jobCards.length > 0) {
    for (const card of jobCards) {
      const $card = $(card)

      const titleEl = $card
        .find('h2 a, h3 a, .job-title a, [data-test="job-title"] a, a.job-title')
        .first()
      const title = titleEl.text().trim()
      const href = titleEl.attr('href') || $card.find('a').first().attr('href') || ''
      if (!title || !href) continue

      const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
      const idMatch = href.match(/\/(\d+)(?:\/|$)/) || href.match(/jobadvert\/([^/?]+)/)
      const externalId = idMatch
        ? `eng-${idMatch[1]}`
        : `eng-${Buffer.from(jobUrl).toString('base64').slice(0, 16)}`

      const organisation = $card
        .find('[data-test="employer-name"], .employer-name, .organisation, .trust')
        .first()
        .text()
        .trim()
      const location = $card
        .find('[data-test="location"], .location, .job-location')
        .first()
        .text()
        .trim()
      const band = $card
        .find('[data-test="pay-band"], .pay-band, .band, [class*="band"]')
        .first()
        .text()
        .trim()

      // Prefer the URL-derived type (reliable); fall back to HTML only if we have no params
      const htmlEmpType = $card
        .find('[data-test="working-pattern"], .working-pattern, [class*="pattern"]')
        .first()
        .text()
        .trim()
      const employment_type = derivedEmpType || htmlEmpType

      const closingText = $card
        .find('[data-test="closing-date"], .closing-date, [class*="closing"]')
        .first()
        .text()
        .trim()
      const postedText = $card
        .find('[data-test="date-posted"], .date-posted, [class*="posted"]')
        .first()
        .text()
        .trim()

      results.push({
        external_id: externalId,
        source: 'england',
        title,
        organisation,
        location,
        band,
        employment_type,
        url: jobUrl,
        posted_at: parseDate(postedText, /date posted[:\s]*/i),
        closes_at: parseDate(closingText, /closing date[:\s]*/i),
      })
    }
    return results
  }

  // Fallback: JSON-LD structured data
  const jsonLd = $('script[type="application/ld+json"]').text()
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd)
      const items = Array.isArray(data) ? data : data['@graph'] || []
      for (const item of items) {
        if (item['@type'] !== 'JobPosting') continue
        const externalId = item.identifier?.value || item.url?.split('/').pop() || ''
        if (!externalId) continue
        results.push({
          external_id: `eng-${externalId}`,
          source: 'england',
          title: item.title || 'Unknown',
          organisation: item.hiringOrganization?.name || '',
          location: item.jobLocation?.address?.addressLocality || '',
          band: item.baseSalary?.value?.description || '',
          employment_type: derivedEmpType || item.employmentType || '',
          url: item.url || url,
          posted_at: item.datePosted ? new Date(item.datePosted).toISOString() : null,
          closes_at: item.validThrough ? new Date(item.validThrough).toISOString() : null,
        })
      }
    } catch {
      // JSON parse failed, nothing to do
    }
  }

  return results
}

/**
 * Scrape NHS England jobs for the given targeted parameters.
 * Runs multiple pages in parallel and tags employment_type from URL params
 * (not from HTML parsing which is unreliable).
 */
export async function scrapeNHSEngland(params: EnglandScrapeParams): Promise<ScrapedVacancy[]> {
  const pagesToFetch = params.pages ?? 2
  const derivedEmpType = deriveEmploymentType(params)
  const allResults: ScrapedVacancy[] = []

  const pageResults = await Promise.all(
    Array.from({ length: pagesToFetch }, (_, i) => i + 1).map(async (page) => {
      const url = buildSearchUrl({ ...params, page })
      try {
        return await scrapePage(url, derivedEmpType)
      } catch (err) {
        console.error(
          `[england scraper] Page ${page} error:`,
          err instanceof Error ? err.message : err
        )
        return []
      }
    })
  )

  for (const pageResult of pageResults) allResults.push(...pageResult)

  // Deduplicate by external_id
  const seen = new Set<string>()
  return allResults.filter((v) => {
    if (seen.has(v.external_id)) return false
    seen.add(v.external_id)
    return true
  })
}

/**
 * Check if a specific NHS England vacancy is still open by visiting its page.
 */
export async function checkEnglandVacancyOpen(vacancyUrl: string): Promise<boolean> {
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
      'this vacancy is now closed',
      'applications are closed',
      'no longer accepting',
      'closing date has passed',
      'this job is closed',
    ]
    for (const signal of closedSignals) {
      if (pageText.includes(signal)) return false
    }

    return true
  } catch {
    return true // On error, assume still open (don't remove prematurely)
  }
}
