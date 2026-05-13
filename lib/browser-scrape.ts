/**
 * Headless-browser scraper powered by Browserless.io REST API.
 * POSTs the URL to Browserless and gets back fully-rendered HTML —
 * a plain HTTP fetch, no WebSocket or local Chromium needed.
 */
import * as cheerio from 'cheerio'

const PS_LABELS = ['person spec', 'person specification', ' ps ', 'jdps', 'jd and ps', 'jd & ps', 'jd/ps']
const JD_LABELS = ['job description', 'job desc', 'jd ', 'job detail', 'job pack', 'role profile']

export interface BrowserScrapeResult {
  rawText: string
  jobTitle: string
  organisation: string
  downloadedDocs: string[]
}

export async function browserScrapeJob(url: string): Promise<BrowserScrapeResult | null> {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) {
    console.log('[browser] BROWSERLESS_TOKEN not set — skipping')
    return null
  }

  const cleanUrl = url.includes('jobs.scot.nhs.uk') ? url : url.split('?')[0]
  console.log(`[browser] Fetching rendered HTML via Browserless for ${cleanUrl}`)

  try {
    // Use Browserless REST API — simple HTTP POST, returns fully rendered HTML
    const res = await fetch(`https://chrome.browserless.io/content?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: cleanUrl,
        waitForTimeout: 5000,
        setExtraHTTPHeaders: {
          'Cookie': 'nhsuk-cookie-consent=%7B%22preferences%22%3Atrue%2C%22statistics%22%3Atrue%2C%22marketing%22%3Atrue%2C%22version%22%3A1%7D',
        },
      }),
      signal: AbortSignal.timeout(40000),
    })

    console.log(`[browser] Browserless status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text()
      console.log(`[browser] Browserless error body: ${body.slice(0, 200)}`)
      return null
    }

    const html = await res.text()
    console.log(`[browser] Got ${html.length} chars of rendered HTML`)

    const $ = cheerio.load(html)

    const jobTitle = $('title').text().replace(/ - .*$/, '').trim()
    const organisation = $('[class*="employer"],[class*="organisation"],[class*="trust"]').first().text().trim()
      || $('h2').first().text().trim()

    // Find document links using section headings and link scoring
    const SECTION_HEADINGS = [
      'supporting documents', 'supporting information', 'documents to download',
      'documents', 'attachments', 'downloads', 'supporting files',
    ]

    const seen = new Set<string>()
    const candidates: Array<{ href: string; text: string; score: number }> = []

    function addLink(href: string, text: string) {
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return
      try {
        const abs = href.startsWith('http') ? href : new URL(href, cleanUrl).toString()
        const norm = abs.split('?')[0].toLowerCase()
        if (seen.has(norm)) return
        seen.add(norm)

        const t = text.toLowerCase().trim()
        const h = norm
        let score = 0
        if (t.includes('person spec') || t.includes('person specification')) score = 10
        else if (t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps')) score = 9
        else if (t.includes('job description') || t.includes('job desc')) score = 8
        else if (t.includes('job pack') || t.includes('role profile')) score = 7
        else if (t.includes('application pack') || t.includes('candidate pack')) score = 6
        else if (t.includes('supporting') || t.includes('information pack')) score = 5
        else if (h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc')) score = 5
        else if (h.includes('/download') || h.includes('/attachment') || h.includes('/file') || h.includes('/document')) score = 4
        else if (t.includes('download') || t.includes('attachment')) score = 3

        if (score > 0) candidates.push({ href: abs, text: text.trim(), score })
      } catch { /* skip */ }
    }

    // Priority: links inside known document sections
    $('h1,h2,h3,h4,h5,h6,dt,summary,th,[role="heading"]').each((_, el) => {
      const heading = $(el).text().trim().toLowerCase().replace(/\s+/g, ' ')
      if (!SECTION_HEADINGS.includes(heading)) return
      $(el).next().find('a[href]').each((__, a) => addLink($(a).attr('href') || '', $(a).text()))
      $(el).parent().find('a[href]').each((__, a) => addLink($(a).attr('href') || '', $(a).text()))
    })

    // Then all other links on the page
    $('a[href]').each((_, el) => addLink($(el).attr('href') || '', $(el).text()))

    candidates.sort((a, b) => b.score - a.score)
    console.log(`[browser] Found ${candidates.length} doc candidates`)
    candidates.slice(0, 5).forEach(l => console.log(`  [link] score=${l.score} "${l.text}" ${l.href}`))

    // Smart priority: person spec first, then JD, then all candidates
    const psLinks = candidates.filter(l => PS_LABELS.some(p => l.text.toLowerCase().includes(p)))
    const jdLinks = candidates.filter(l => JD_LABELS.some(p => l.text.toLowerCase().includes(p)))
    const toDownload = psLinks.length > 0 ? psLinks : jdLinks.length > 0 ? jdLinks : candidates

    // Download and parse files
    const downloadedDocs: string[] = []
    let personSpecText = ''
    let otherDocText = ''

    for (const link of toDownload.slice(0, 8)) {
      try {
        const text = await downloadAndParseDoc(link.href)
        if (!text || text.length < 200) continue
        const truncated = smartExtract(text, 60000)
        const lower = text.toLowerCase()
        const label = link.text || link.href.split('/').pop() || 'Document'
        downloadedDocs.push(label)
        console.log(`[browser] Downloaded "${label}" — ${text.length} chars`)
        if (lower.includes('person specification') || lower.includes('essential criteria')) {
          personSpecText += `\n\n--- ${label} (PERSON SPECIFICATION) ---\n${truncated}`
        } else {
          otherDocText += `\n\n--- ${label} ---\n${truncated}`
        }
      } catch (err) {
        console.log(`[browser] Failed to download ${link.href}: ${(err as Error).message}`)
      }
    }

    const combinedDocText = personSpecText + otherDocText
    const pageText = $('body').text().replace(/\s+/g, ' ').trim()
    const cleanPage = smartExtract(pageText, 30000)

    const rawText = combinedDocText.length > 200
      ? combinedDocText + '\n\n=== PAGE TEXT (SUPPLEMENTAL) ===\n' + cleanPage
      : cleanPage

    return { rawText, jobTitle, organisation, downloadedDocs }
  } catch (err) {
    console.log(`[browser] Error: ${(err as Error).message}`)
    return null
  }
}

async function downloadAndParseDoc(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,*/*',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) return ''

  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  const urlLower = url.toLowerCase()
  const buffer = Buffer.from(await res.arrayBuffer())

  if (contentType.includes('pdf') || urlLower.includes('.pdf')) return parsePdf(buffer)
  if (contentType.includes('wordprocessingml') || contentType.includes('msword') || urlLower.includes('.docx') || urlLower.includes('.doc')) return parseDocx(buffer)

  const pdfText = await parsePdf(buffer)
  if (pdfText.length > 100) return pdfText
  return parseDocx(buffer)
}

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse')
    const data = await pdfParse(buffer)
    return (data.text as string) || ''
  } catch { return '' }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch { return '' }
}

function smartExtract(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const lower = text.toLowerCase()
  const patterns = [/person\s+specification/, /essential\s+criteria/]
  let psStart = -1
  for (const pat of patterns) {
    const idx = lower.search(pat)
    if (idx !== -1 && (psStart === -1 || idx < psStart)) psStart = idx
  }
  if (psStart > 0) {
    const context = text.slice(0, Math.min(3000, psStart))
    return context + '\n\n[...]\n\n' + text.slice(psStart, psStart + (maxChars - context.length))
  }
  const half = Math.floor(maxChars / 2)
  return text.slice(0, half) + '\n\n[...]\n\n' + text.slice(-half)
}
