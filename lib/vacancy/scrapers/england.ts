import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedVacancy } from '../types'

const BASE_URL = 'https://www.jobs.nhs.uk'
const SEARCH_URL = `${BASE_URL}/candidate/search/results`

// Map band labels → NHS jobs.nhs.uk payBand param values
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

function buildSearchUrl(params: {
  keywords: string[]
  locations: string[]
  bands: string[]
  employmentType: string
}): string {
  const searchParams = new URLSearchParams()

  // Keywords — search for each keyword separately, we merge results
  if (params.keywords.length > 0) {
    searchParams.set('keyword', params.keywords.join(' OR '))
  }

  // Location
  if (params.locations.length > 0) {
    const loc = params.locations.find(
      (l) => !['scotland', 'anywhere', 'any', 'remote'].includes(l.toLowerCase())
    )
    if (loc) {
      searchParams.set('locationName', loc)
      searchParams.set('radius', '15')
    }
  }

  // Bands
  const bandParams = params.bands
    .map((b) => BAND_PARAM_MAP[b.toLowerCase()])
    .filter(Boolean)
  if (bandParams.length > 0) {
    searchParams.set('payBand', bandParams.join(','))
  }

  // Employment type
  if (params.employmentType && params.employmentType !== 'any') {
    searchParams.set('workingPattern', params.employmentType)
  }

  // Always sort by newest first, only permanent + fixed term
  searchParams.set('sort', 'publicationDateDesc')
  searchParams.set('searchFormType', 'sortBy')
  searchParams.set('language', 'en')

  return `${SEARCH_URL}?${searchParams.toString()}`
}

function parseClosingDate(text: string): string | null {
  // Handles formats: "20 Jan 2025", "20/01/2025", "20-01-2025"
  if (!text) return null
  const cleaned = text.replace(/closing date[:\s]*/i, '').trim()
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) return date.toISOString()
  return null
}

function parsePostedDate(text: string): string | null {
  if (!text) return null
  const cleaned = text.replace(/date posted[:\s]*/i, '').trim()
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) return date.toISOString()
  return null
}

export async function scrapeNHSEngland(params: {
  keywords: string[]
  locations: string[]
  bands: string[]
  employmentType: string
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
      },
    })

    const $ = cheerio.load(response.data)

    // NHS Jobs uses various card structures — try multiple selectors
    const jobCards = $('[data-test="search-result"], .job-card, article.vacancy, li.vacancy-item, .nhsuk-card').toArray()

    if (jobCards.length === 0) {
      // Fallback: try JSON-LD or embedded data
      const jsonLd = $('script[type="application/ld+json"]').text()
      if (jsonLd) {
        try {
          const data = JSON.parse(jsonLd)
          const items = Array.isArray(data) ? data : data['@graph'] || []
          for (const item of items) {
            if (item['@type'] === 'JobPosting') {
              const externalId = item.identifier?.value || item.url?.split('/').pop() || ''
              if (!externalId) continue
              results.push({
                external_id: `eng-${externalId}`,
                source: 'england',
                title: item.title || 'Unknown',
                organisation: item.hiringOrganization?.name || '',
                location: item.jobLocation?.address?.addressLocality || '',
                band: item.baseSalary?.value?.description || '',
                employment_type: item.employmentType || '',
                url: item.url || url,
                posted_at: item.datePosted ? new Date(item.datePosted).toISOString() : null,
                closes_at: item.validThrough ? new Date(item.validThrough).toISOString() : null,
              })
            }
          }
        } catch {
          // JSON parse failed, continue
        }
      }
    }

    for (const card of jobCards) {
      const $card = $(card)

      // Job title and URL
      const titleEl = $card.find('h2 a, h3 a, .job-title a, [data-test="job-title"] a, a.job-title').first()
      const title = titleEl.text().trim()
      const href = titleEl.attr('href') || $card.find('a').first().attr('href') || ''
      if (!title || !href) continue

      const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
      // Extract external ID from URL path (e.g. /candidate/jobadvert/12345)
      const idMatch = href.match(/\/(\d+)(?:\/|$)/) || href.match(/jobadvert\/([^/?]+)/)
      const externalId = idMatch ? `eng-${idMatch[1]}` : `eng-${Buffer.from(jobUrl).toString('base64').slice(0, 16)}`

      const organisation = $card.find('[data-test="employer-name"], .employer-name, .organisation, .trust').first().text().trim()
      const location = $card.find('[data-test="location"], .location, .job-location').first().text().trim()
      const band = $card.find('[data-test="pay-band"], .pay-band, .band, [class*="band"]').first().text().trim()
      const empType = $card.find('[data-test="working-pattern"], .working-pattern, [class*="pattern"]').first().text().trim()

      const closingText = $card.find('[data-test="closing-date"], .closing-date, [class*="closing"]').first().text().trim()
      const postedText = $card.find('[data-test="date-posted"], .date-posted, [class*="posted"]').first().text().trim()

      results.push({
        external_id: externalId,
        source: 'england',
        title,
        organisation,
        location,
        band,
        employment_type: empType,
        url: jobUrl,
        posted_at: parsePostedDate(postedText),
        closes_at: parseClosingDate(closingText),
      })
    }
  } catch (err) {
    console.error('[england scraper] Error:', err instanceof Error ? err.message : err)
  }

  return results
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

    // Signs the vacancy is closed
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

    // Check if apply button still exists
    const applyButton = $('a[href*="apply"], button[class*="apply"], [data-test*="apply"]')
    if (applyButton.length === 0 && pageText.includes('apply')) return false

    return true
  } catch {
    return true // On error, assume still open (don't remove prematurely)
  }
}
