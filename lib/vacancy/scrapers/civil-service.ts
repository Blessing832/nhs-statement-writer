import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedVacancy } from '../types'

const BASE_URL = 'https://www.civilservicejobs.service.gov.uk'
const SEARCH_URL = `${BASE_URL}/csr/jobs.cgi`

function buildSearchUrl(params: { keywords: string[]; locations: string[] }): string {
  const searchParams = new URLSearchParams()
  searchParams.set('action', 'search_apply')
  searchParams.set('jcode', '1')

  if (params.keywords.length > 0) {
    searchParams.set('keyword', params.keywords.join(' '))
  }

  const loc = params.locations.find(
    (l) => !['scotland', 'anywhere', 'any', 'remote'].includes(l.toLowerCase())
  )
  if (loc) {
    searchParams.set('location', loc)
  }

  // NHS / health related departments — filter to relevant departments
  searchParams.set('orderby', 'closingdate')
  searchParams.set('order', 'asc')

  return `${SEARCH_URL}?${searchParams.toString()}`
}

function parseCivilDate(text: string): string | null {
  if (!text) return null
  // Format: "20/01/2025" or "20 Jan 2025"
  const cleaned = text.trim()
  // Try DD/MM/YYYY
  const ddmmyyyy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    if (!isNaN(date.getTime())) return date.toISOString()
  }
  // Try natural language
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) return date.toISOString()
  return null
}

export async function scrapeCivilService(params: {
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

    // Civil Service Jobs uses a table-based layout
    const jobRows = $('tr.search-results-job-box, .search-result, li.job-result, .vacancy-item').toArray()

    // Fallback: look for any table rows with job links
    const rows = jobRows.length > 0 ? jobRows : $('table.search-results tr:not(:first-child)').toArray()

    for (const row of rows) {
      const $row = $(row)

      const titleEl = $row.find('a.job-title, a[href*="jcode="], td:first-child a').first()
      const title = titleEl.text().trim()
      const href = titleEl.attr('href') || ''
      if (!title || !href) continue

      const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`

      // Extract jcode from URL
      const jcodeMatch = href.match(/jcode=(\d+)/)
      const externalId = jcodeMatch ? `civil-${jcodeMatch[1]}` : `civil-${Buffer.from(jobUrl).toString('base64').slice(0, 16)}`

      const organisation = $row.find('.department, .organisation, td:nth-child(2)').first().text().trim()
      const location = $row.find('.location, td.location').first().text().trim()
      const grade = $row.find('.grade, .band, td.grade').first().text().trim()
      const empType = $row.find('.contract-type, .hours, td.contract').first().text().trim()
      const closingText = $row.find('.closing-date, td.closing-date').first().text().trim()

      results.push({
        external_id: externalId,
        source: 'civil-service',
        title,
        organisation,
        location,
        band: grade,
        employment_type: empType,
        url: jobUrl,
        posted_at: null,
        closes_at: parseCivilDate(closingText),
      })
    }
  } catch (err) {
    console.error('[civil-service scraper] Error:', err instanceof Error ? err.message : err)
  }

  return results
}

export async function checkCivilServiceVacancyOpen(vacancyUrl: string): Promise<boolean> {
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
      'this vacancy has closed',
      'applications are no longer',
      'closing date has passed',
      'this job is no longer available',
    ]
    return !closedSignals.some((s) => pageText.includes(s))
  } catch {
    return true
  }
}
