import * as cheerio from 'cheerio'
import { browserScrapeJob } from './browser-scrape'
import type { ScrapeResult } from './types'

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cookie': 'nhsuk-cookie-consent=%7B%22preferences%22%3Atrue%2C%22statistics%22%3Atrue%2C%22marketing%22%3Atrue%2C%22version%22%3A1%7D',
}

export function isEnglandNhsSite(url: string): boolean {
  return url.includes('jobs.nhs.uk') || url.includes('healthjobsuk.com')
}

export function getJobUrl(url: string): string {
  if (url.includes('jobs.scot.nhs.uk')) return url
  return url.split('?')[0]
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, noscript, nav, footer, header, [id*="cookie"], [class*="cookie"], [id*="banner"], [class*="banner"]').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}

export function hasJobContent(text: string): boolean {
  const t = text.toLowerCase()
  return (
    t.includes('person specification') ||
    t.includes('essential criteria') ||
    t.includes('desirable criteria') ||
    t.includes('job description') ||
    t.includes('main duties') ||
    t.includes('key responsibilities') ||
    t.includes('band ') ||
    t.includes('foundation trust') ||
    t.includes('nhs trust') ||
    t.includes('nhs board') ||
    t.includes('nhs scotland') ||
    t.includes('senior charge nurse') ||
    t.includes('salary:') ||
    t.includes('closing date')
  )
}

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return (data.text as string) || ''
  } catch {
    return ''
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch {
    return ''
  }
}

async function fetchAttachmentText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { ...BASE_HEADERS, 'Accept': 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,*/*' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return ''

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    const urlLower = url.toLowerCase()
    const isPdf = contentType.includes('pdf') || urlLower.includes('.pdf')
    const isDocx = contentType.includes('wordprocessingml') || contentType.includes('msword') || urlLower.includes('.docx') || urlLower.includes('.doc')

    const buffer = Buffer.from(await res.arrayBuffer())
    if (isPdf) return parsePdf(buffer)
    if (isDocx) return parseDocx(buffer)

    const pdfText = await parsePdf(buffer)
    if (pdfText.length > 100) return pdfText
    return parseDocx(buffer)
  } catch {
    return ''
  }
}

function extractUrlsFromJson(obj: unknown, baseUrl: string, out: Set<string>): void {
  if (typeof obj === 'string') {
    const lower = obj.toLowerCase()
    if (
      obj.length > 5 &&
      (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc') ||
       lower.includes('/download') || lower.includes('/attachment') ||
       lower.includes('/file') || lower.includes('/document'))
    ) {
      try {
        const abs = obj.startsWith('http') ? obj : new URL(obj, baseUrl).toString()
        out.add(abs)
      } catch { /* skip */ }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(v => extractUrlsFromJson(v, baseUrl, out))
  } else if (obj && typeof obj === 'object') {
    Object.values(obj as Record<string, unknown>).forEach(v => extractUrlsFromJson(v, baseUrl, out))
  }
}

function extractNextDataDocUrls(html: string, baseUrl: string): string[] {
  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!match) return []
    const nextData = JSON.parse(match[1]) as unknown
    const urls = new Set<string>()
    extractUrlsFromJson(nextData, baseUrl, urls)
    return [...urls]
  } catch {
    return []
  }
}

const PS_LABELS  = ['person spec', 'person specification', ' ps ', 'jdps', 'jd and ps', 'jd & ps', 'jd/ps']
const JD_LABELS  = ['job description', 'job desc', 'jd ', 'job pack', 'role profile', 'role description']
const DOC_SECTION_HEADINGS = [
  'supporting documents', 'supporting information', 'documents to download',
  'documents', 'attachments', 'downloads', 'supporting files',
]

function scoreLink(text: string, href: string): number {
  const t = text.toLowerCase().trim()
  const h = href.toLowerCase()
  if (t.includes('person spec') || t.includes('person specification')) return 10
  if (t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps')) return 9
  if (t.includes('job description') || t.includes('job desc')) return 8
  if (t.includes('job pack') || t.includes('role profile')) return 7
  if (t.includes('application pack') || t.includes('candidate pack')) return 6
  if (t.includes('supporting document') || t.includes('supporting info')) return 5
  if (h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc')) return 5
  if (h.includes('/download') || h.includes('/attachment') || h.includes('/file') || h.includes('/document')) return 4
  if (t.includes('download') || t.includes('attachment')) return 3
  return 0
}

function findJdpsLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const seen = new Set<string>()
  const all: Array<{ url: string; text: string; score: number }> = []

  function addLink(href: string, text: string) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return
    try {
      const abs = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
      const norm = abs.split('?')[0].toLowerCase()
      if (seen.has(norm)) return
      seen.add(norm)
      const s = scoreLink(text, norm)
      if (s > 0) all.push({ url: abs, text, score: s })
    } catch { /* skip */ }
  }

  $('h1,h2,h3,h4,h5,h6,dt,summary,th').each((_, el) => {
    const heading = $(el).text().trim().toLowerCase().replace(/\s+/g, ' ')
    if (!DOC_SECTION_HEADINGS.includes(heading)) return
    const $container = $(el).next().add($(el).closest('details')).add($(el).parent())
    $container.find('a[href]').each((__, a) => addLink($(a).attr('href') || '', $(a).text().trim()))
  })

  const attachSelectors = [
    '[class*="attachment"]', '[id*="attachment"]',
    '[class*="supporting"]', '[id*="supporting"]',
    '[class*="document"]',   '[id*="document"]',
    '[class*="download"]',   '[id*="download"]',
    '[aria-label*="document"]', '[aria-label*="attachment"]',
    '[aria-label*="supporting"]',
  ]
  attachSelectors.forEach(sel => {
    try { $(sel).find('a[href]').each((_, el) => addLink($(el).attr('href') || '', $(el).text().trim())) }
    catch { /* skip */ }
  })

  $('a[href]').each((_, el) => addLink($(el).attr('href') || '', $(el).text().trim()))

  all.sort((a, b) => b.score - a.score)
  const psLinks = all.filter(l => PS_LABELS.some(p => l.text.toLowerCase().includes(p)))
  const jdLinks = all.filter(l => JD_LABELS.some(p => l.text.toLowerCase().includes(p)))
  const chosen = psLinks.length > 0 ? psLinks : jdLinks.length > 0 ? jdLinks : all
  return chosen.slice(0, 8).map(l => l.url)
}

async function extractAttachmentText($: cheerio.CheerioAPI, pageUrl: string, html: string): Promise<string> {
  const cheerioLinks = findJdpsLinks($, pageUrl)
  const nextDataUrls = extractNextDataDocUrls(html, pageUrl)

  const seen = new Set<string>()
  const allLinks: string[] = []
  for (const u of [...cheerioLinks, ...nextDataUrls]) {
    const norm = u.split('?')[0].toLowerCase()
    if (!seen.has(norm)) { seen.add(norm); allLinks.push(u) }
  }
  if (allLinks.length === 0) return ''

  const results = await Promise.allSettled(allLinks.slice(0, 8).map(fetchAttachmentText))
  const texts: string[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length > 200) texts.push(r.value)
  }
  return texts.join('\n\n')
}

async function directFetch(url: string): Promise<{ rawText: string; jobTitle: string; organisation: string } | null> {
  try {
    const cleanUrl = getJobUrl(url)
    const res = await fetch(cleanUrl, {
      headers: { ...BASE_HEADERS, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const html = await res.text()
    let rawText = htmlToText(html)
    const isScotland = url.includes('jobs.scot.nhs.uk')
    if (rawText.length < 300) return null
    if (!isScotland && !hasJobContent(rawText)) return null

    const $ = cheerio.load(html)
    const attachmentText = await extractAttachmentText($, cleanUrl, html)
    if (attachmentText.length > 200) {
      rawText += '\n\n=== ATTACHED PERSON SPECIFICATION / JOB DESCRIPTION ===\n' + attachmentText
    }

    const titleTag = $('title').text().trim()
    const h1 = $('h1').first().text().trim()
    const jobTitle = h1 || titleTag.split('|')[0].trim() || ''
    const organisation = titleTag.split('|')[1]?.trim() || ''
    return { rawText, jobTitle, organisation }
  } catch {
    return null
  }
}

export interface ScrapeJobResult extends ScrapeResult {
  hasAttachedPs?: boolean
  likelySparsePs?: boolean
  downloadedDocs?: string[]
}

export async function scrapeJobUrl(url: string): Promise<ScrapeJobResult> {
  // Step 1: Direct server-side fetch (fast, works for SSR pages and __NEXT_DATA__)
  const direct = await directFetch(url)
  if (direct) {
    const directHasAttachment = direct.rawText.includes('=== ATTACHED PERSON SPECIFICATION')
    const directEssentials = (direct.rawText.match(/\bessential\b/gi) || []).length
    if (!isEnglandNhsSite(url) || directHasAttachment) {
      return {
        rawText: direct.rawText,
        jobTitle: direct.jobTitle,
        organisation: direct.organisation,
        jobDescription: direct.rawText,
        personSpec: '',
        source: 'direct',
        hasAttachedPs: directHasAttachment,
        likelySparsePs: !directHasAttachment && directEssentials < 8,
      }
    }
  }

  // Step 2: Inline headless Chrome (England/HealthJobsUK — renders JS, finds hidden PDFs)
  const browserResult = url.includes('jobs.scot.nhs.uk') ? null : await browserScrapeJob(url)
  if (browserResult && browserResult.rawText.length > 300 && hasJobContent(browserResult.rawText.toLowerCase())) {
    const hasFullPs =
      browserResult.downloadedDocs.length > 0 ||
      browserResult.rawText.toLowerCase().includes('person specification') ||
      browserResult.rawText.toLowerCase().includes('essential criteria')
    const essentialCount = (browserResult.rawText.match(/\bessential\b/gi) || []).length
    return {
      rawText: browserResult.rawText,
      jobTitle: browserResult.jobTitle,
      organisation: browserResult.organisation,
      jobDescription: browserResult.rawText,
      personSpec: '',
      source: 'browser',
      hasAttachedPs: browserResult.downloadedDocs.length > 0,
      likelySparsePs: !hasFullPs && essentialCount < 8,
      downloadedDocs: browserResult.downloadedDocs,
    }
  }

  // Step 3: External Railway scraper (fallback)
  const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL
  const SCRAPER_SECRET = process.env.SCRAPER_SECRET
  if (SCRAPER_URL && SCRAPER_SECRET) {
    const cleanUrl = getJobUrl(url)
    try {
      const response = await fetch(`${SCRAPER_URL}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-scraper-secret': SCRAPER_SECRET },
        body: JSON.stringify({ url: cleanUrl }),
        signal: AbortSignal.timeout(50000),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.rawText && data.rawText.length > 300 && hasJobContent((data.rawText as string).toLowerCase())) {
          const essentialCount = ((data.rawText as string).match(/\bessential\b/gi) || []).length
          const hasFullPs = (data.rawText as string).includes('=== ATTACHED PERSON SPECIFICATION')
          return {
            ...data,
            jobDescription: data.rawText,
            personSpec: '',
            hasAttachedPs: hasFullPs,
            likelySparsePs: !hasFullPs && essentialCount < 8,
          }
        }
      }
    } catch { /* fall through to error */ }
  }

  throw new Error('Could not read this job page automatically. Please copy and paste the job description text instead.')
}
