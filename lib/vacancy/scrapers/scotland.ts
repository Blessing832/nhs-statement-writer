import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedVacancy } from '../types'

const BASE_URL = 'https://apply.jobs.scot.nhs.uk'
const SEARCH_URL = `${BASE_URL}/Home/Job`

function buildSearchUrl(params: {
  keywords: string[]
  locations: string[]
}): string {
  const searchParams = new URLSearchParams()

  if (params.keywords.length > 0) {
    searchParams.set('search', params.keywords.join(' '))
  }

  const loc = params.locations.find(
    (l) => !['england', 'anywhere', 'any'].includes(l.toLowerCase())
  )
  if (loc && loc.toLowerCase() !== 'scotland') {
    searchParams.set('location', loc)
  }

  // Sort by most recent
  searchParams.set('sort', 'DatePostedDesc')

  return `${SEARCH_URL}?${searchParams.toString()}`
}

function parseScotDate(text: string): string | null {
  if (!text) return null
  // Common format: "20 January 2025" or "20/01/2025"
  const cleaned = text.replace(/closing date[:\s]*/i, '').replace(/posted[:\s]*/i, '').trim()
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) return date.toISOString()
  return null
}

export async function scrapeNHSScotland(params: {
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
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    })

    const $ = cheerio.load(response.data)

    // Scotland NHS job listing selectors
    const jobCards = $(
      '.vacancy-item, .job-listing, .vacancy-listing, article.job, .search-result-item, tr.vacancy-row'
    ).toArray()

    for (const card of jobCards) {
      const $card = $(card)

      const titleEl = $card.find('h2 a, h3 a, .job-title a, a.vacancy-title, td.title a').first()
      const title = titleEl.text().trim()
      const href = titleEl.attr('href') || ''
      if (!title || !href) continue

      const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
      const idMatch = href.match(/\/Job\/(\d+)/) || href.match(/[\?&]id=(\d+)/) || href.match(/\/(\d+)(?:\/|$)/)
      const externalId = idMatch ? `scot-${idMatch[1]}` : `scot-${Buffer.from(jobUrl).toString('base64').slice(0, 16)}`

      const organisation = $card
        .find('.employer, .organisation, .trust, .board, td.employer')
        .first()
        .text()
        .trim()

      const location = $card
        .find('.location, .job-location, td.location, [class*="location"]')
        .first()
        .text()
        .trim()

      const band = $card
        .find('.band, .grade, .salary, td.band, [class*="band"]')
        .first()
        .text()
        .trim()

      const empType = $card
        .find('.hours, .contract-type, .working-pattern, td.hours')
        .first()
        .text()
        .trim()

      const closingText = $card
        .find('.closing-date, .close-date, td.closing, [class*="closing"]')
        .first()
        .text()
        .trim()

      const postedText = $card
        .find('.posted-date, .date-posted, td.posted, [class*="posted"]')
        .first()
        .text()
        .trim()

      // Basic band filter if applicant specified bands
      if (params.bands.length > 0 && band) {
        const bandLower = band.toLowerCase()
        const match = params.bands.some((b) => bandLower.includes(b.toLowerCase().replace('band ', '')))
        if (!match) continue
      }

      results.push({
        external_id: externalId,
        source: 'scotland',
        title,
        organisation,
        location: location || 'Scotland',
        band,
        employment_type: empType,
        url: jobUrl,
        posted_at: parseScotDate(postedText),
        closes_at: parseScotDate(closingText),
      })
    }
  } catch (err) {
    console.error('[scotland scraper] Error:', err instanceof Error ? err.message : err)
  }

  return results
}

export async function checkScotlandVacancyOpen(vacancyUrl: string): Promise<boolean> {
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
      'this vacancy is closed',
      'no longer available',
      'applications closed',
      'this post is closed',
    ]
    return !closedSignals.some((s) => pageText.includes(s))
  } catch {
    return true
  }
}
