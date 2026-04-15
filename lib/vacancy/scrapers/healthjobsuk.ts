import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedVacancy } from '../types'

const BASE_URL = 'https://www.healthjobsuk.com'
const SEARCH_URL = `${BASE_URL}/job_list`

function buildSearchUrl(params: {
  keywords: string[]
  locations: string[]
}): string {
  const searchParams = new URLSearchParams()

  if (params.keywords.length > 0) {
    searchParams.set('j', params.keywords.join(' '))
  }

  const loc = params.locations.find(
    (l) => !['anywhere', 'any', 'remote'].includes(l.toLowerCase())
  )
  if (loc) {
    searchParams.set('l', loc)
  }

  // Sort by date — newest first
  searchParams.set('s', 'date')
  searchParams.set('o', 'desc')

  return `${SEARCH_URL}?${searchParams.toString()}`
}

function parseHJDate(text: string): string | null {
  if (!text) return null
  const cleaned = text.replace(/closes?[:\s]*/i, '').replace(/posted[:\s]*/i, '').trim()
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) return date.toISOString()
  // Handle relative dates like "2 days ago"
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

export async function scrapeHealthJobsUK(params: {
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

    const jobCards = $(
      '.job-item, .job-listing, .vacancy, article.job, .search-result, li.result-item'
    ).toArray()

    for (const card of jobCards) {
      const $card = $(card)

      const titleEl = $card.find('h2 a, h3 a, .job-title a, a.title').first()
      const title = titleEl.text().trim()
      const href = titleEl.attr('href') || $card.find('a').first().attr('href') || ''
      if (!title || !href) continue

      const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
      const idMatch = href.match(/\/job\/(\d+)/) || href.match(/\/(\d+)(?:\/|$)/) || href.match(/[\?&]id=(\d+)/)
      const externalId = idMatch
        ? `hjuk-${idMatch[1]}`
        : `hjuk-${Buffer.from(jobUrl).toString('base64').slice(0, 16)}`

      const organisation = $card
        .find('.employer, .company, .organisation, .trust, [class*="employer"]')
        .first()
        .text()
        .trim()

      const location = $card
        .find('.location, [class*="location"]')
        .first()
        .text()
        .trim()

      const band = $card
        .find('.salary, .band, .grade, [class*="salary"], [class*="band"]')
        .first()
        .text()
        .trim()

      const empType = $card
        .find('.job-type, .contract, .hours, [class*="type"]')
        .first()
        .text()
        .trim()

      const closingText = $card
        .find('.closing-date, .close-date, .expires, [class*="closing"]')
        .first()
        .text()
        .trim()

      const postedText = $card
        .find('.posted, .date-posted, [class*="posted"]')
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

  return results
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
    ]
    return !closedSignals.some((s) => pageText.includes(s))
  } catch {
    return true
  }
}
