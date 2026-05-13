import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as cheerio from 'cheerio'
import { browserScrapeJob } from '@/lib/browser-scrape'

// Increase timeout: Chromium download + page render + PDF downloads can take 90s
export const maxDuration = 120

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL
const SCRAPER_SECRET = process.env.SCRAPER_SECRET

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cookie': 'nhsuk-cookie-consent=%7B%22preferences%22%3Atrue%2C%22statistics%22%3Atrue%2C%22marketing%22%3Atrue%2C%22version%22%3A1%7D',
}

// NHS job boards where a sparse direct-fetch result should not be accepted —
// Puppeteer can click tabs and download the JDPS PDF with a real browser session
const NHS_HOSTS = ['jobs.nhs.uk', 'healthjobsuk.com', 'apply.jobs.scot.nhs.uk', 'jobs.scot.nhs.uk']
function isNhsJobSite(url: string): boolean {
  return NHS_HOSTS.some(h => url.includes(h))
}

// Strip HTML tags and collapse whitespace
function htmlToText(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, noscript, nav, footer, header, [id*="cookie"], [class*="cookie"], [id*="banner"], [class*="banner"]').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}

function hasJobContent(text: string): boolean {
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
    t.includes('nhs trust')
  )
}

function hasPersonSpec(text: string): boolean {
  const t = text.toLowerCase()
  return (
    (t.includes('person specification') || t.includes('essential criteria')) &&
    t.includes('essential')
  )
}

// Parse a PDF buffer and return plain text
async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // Use internal path to avoid pdf-parse loading test files at import time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse')
    const data = await pdfParse(buffer)
    return (data.text as string) || ''
  } catch {
    return ''
  }
}

// Parse a Word document buffer and return plain text
async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch {
    return ''
  }
}

// Fetch an attachment URL and extract text (PDF or DOCX).
// For extensionless URLs (e.g. NHS Jobs /download/{id}), always attempt PDF parse.
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

    // Unknown content type (common with NHS Jobs extensionless /download/{id} URLs).
    // Try PDF first, then DOCX.
    const pdfText = await parsePdf(buffer)
    if (pdfText.length > 100) return pdfText
    return parseDocx(buffer)
  } catch {
    return ''
  }
}

// Walk a JSON value and collect any string that looks like a document URL.
// Used to extract attachment links from NHS Jobs' embedded __NEXT_DATA__ JSON,
// which contains the full page props (including file URLs) in the raw HTML.
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

// Extract document URLs embedded by Next.js in __NEXT_DATA__ (no JS needed).
// jobs.nhs.uk is a Next.js app — its attachment URLs are in the raw HTML.
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

// Find all document links on the page — cast a wide net so NHS Jobs files
// named after vacancy references (e.g. "C9345-26-0173-JD-PS.pdf") are caught
// even if the link text doesn't contain "person spec" or "job description".
function findJdpsLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const seen = new Set<string>()
  const scored: Array<{ url: string; score: number }> = []

  function addLink(href: string, text: string) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return
    try {
      const abs = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
      const norm = abs.split('?')[0].toLowerCase()
      if (seen.has(norm)) return
      seen.add(norm)

      const t = text.toLowerCase().trim()
      const h = norm
      const score =
        (t.includes('person spec') || t.includes('person specification')) ? 10 :
        (t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps') || t.includes('jd/ps')) ? 9 :
        t.includes('job description') ? 8 :
        (t.includes('job pack') || t.includes('role profile')) ? 7 :
        (t.includes('application pack') || t.includes('candidate pack') || t.includes('recruitment pack')) ? 6 :
        (t.includes('supporting document') || t.includes('supporting info') || t.includes('information pack')) ? 5 :
        (h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc')) ? 4 :
        (h.includes('/download/') || h.includes('/attachment/') || h.includes('/file/') || h.includes('/document/') || h.includes('/files/')) ? 3 :
        t.includes('download') ? 2 :
        t.includes('attachment') ? 2 : 1

      scored.push({ url: abs, score })
    } catch { /* invalid URL, skip */ }
  }

  // Strategy 1 & 2: doc file URLs + keyword-matched link text
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().trim()
    const h = href.toLowerCase()
    const t = text.toLowerCase()

    const isDocFile =
      h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc') ||
      h.includes('/document/') || h.includes('/download/') ||
      h.includes('/attachment/') || h.includes('/file/') || h.includes('/files/')

    const isKeywordMatch =
      t.includes('person spec') || t.includes('job description') || t.includes('job desc') ||
      t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps') || t.includes('jd/ps') ||
      t === 'jd' || t.startsWith('jd ') ||
      t.includes('job spec') || t.includes('job pack') || t.includes('role profile') ||
      t.includes('supporting document') || t.includes('supporting info') ||
      t.includes('application pack') || t.includes('candidate pack') || t.includes('recruitment pack') ||
      t.includes('additional information') || t.includes('further information') ||
      t.includes('attachment') || t.includes('download') || t.includes('view document')

    if (isDocFile || isKeywordMatch) addLink(href, text)
  })

  // Strategy 3: every link inside sections that look like attachment/document areas
  const attachSelectors = [
    '[class*="attachment"]', '[id*="attachment"]',
    '[class*="supporting"]', '[id*="supporting"]',
    '[class*="document"]',   '[id*="document"]',
    '[class*="download"]',   '[id*="download"]',
    '[aria-label*="document"]', '[aria-label*="attachment"]',
    '[aria-label*="supporting"]',
  ]
  attachSelectors.forEach(sel => {
    try {
      $(sel).find('a[href]').each((_, el) => {
        addLink($(el).attr('href') || '', $(el).text().trim())
      })
    } catch { /* invalid selector, skip */ }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => s.url)
}

// Fetch all JDPS attachments and return combined text.
// Merges links found by cheerio (visible HTML) with URLs from __NEXT_DATA__ JSON
// (catches attachments that NHS Jobs renders via JavaScript from embedded page props).
async function extractAttachmentText($: cheerio.CheerioAPI, pageUrl: string, html: string): Promise<string> {
  const cheerioLinks = findJdpsLinks($, pageUrl)
  const nextDataUrls = extractNextDataDocUrls(html, pageUrl)

  // Deduplicate: normalise by stripping query strings
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
    if (r.status === 'fulfilled' && r.value.length > 200) {
      texts.push(r.value)
    }
  }
  return texts.join('\n\n')
}

// Direct server-side fetch — no JS execution, works for SSR pages
async function directFetch(url: string): Promise<{ rawText: string; jobTitle: string; organisation: string } | null> {
  try {
    const cleanUrl = url.split('?')[0]
    const res = await fetch(cleanUrl, {
      headers: { ...BASE_HEADERS, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const html = await res.text()
    let rawText = htmlToText(html)
    if (rawText.length < 300 || !hasJobContent(rawText)) return null

    const $ = cheerio.load(html)

    // Extract attachments via both visible HTML links and __NEXT_DATA__ JSON
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

export async function POST(req: NextRequest) {
  const { client_code, url } = await req.json()

  if (!url || !client_code) {
    return NextResponse.json({ error: 'URL and client code are required' }, { status: 400 })
  }

  // Validate client
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, is_active, subscription_end')
    .eq('client_code', client_code.toUpperCase())
    .eq('is_active', true)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Invalid or inactive client code' }, { status: 401 })
  }

  if (new Date() > new Date(client.subscription_end)) {
    return NextResponse.json(
      { error: 'Your subscription has expired. Please contact the administrator.' },
      { status: 403 }
    )
  }

  // ── Step 1: Try direct server-side fetch first (bypasses cookie walls) ──────
  const direct = await directFetch(url)
  if (direct) {
    const directHasAttachment = direct.rawText.includes('=== ATTACHED PERSON SPECIFICATION')
    const directEssentials = (direct.rawText.match(/\bessential\b/gi) || []).length

    // For NHS job boards: the direct fetch cannot execute JavaScript, so it often
    // misses the JDPS PDF attachment link (rendered dynamically). Only accept the
    // direct result if we actually downloaded the PDF. If we didn't, fall through
    // to Puppeteer which renders JS, finds the link, and downloads the file.
    // Do NOT use criteria count as the gate — a page can show 15–20 criteria on
    // the page while the attached PDF has 30+.
    if (!isNhsJobSite(url) || directHasAttachment) {
      return NextResponse.json({
        rawText: direct.rawText,
        jobTitle: direct.jobTitle,
        organisation: direct.organisation,
        jobDescription: direct.rawText,
        personSpec: '',
        source: 'direct',
        hasAttachedPs: directHasAttachment,
        likelySparsePs: !directHasAttachment && directEssentials < 8,
      })
    }
    // NHS site but no PDF found — fall through to inline headless browser
  }

  // ── Step 2: Inline headless Chrome (Vercel-native, no Railway needed) ────────
  // Launches Chromium inside the serverless function, renders JavaScript,
  // handles cookie consent, clicks tabs, and downloads all attached documents.
  const browserResult = await browserScrapeJob(url)

  if (browserResult && browserResult.rawText.length > 300 && hasJobContent(browserResult.rawText.toLowerCase())) {
    const hasFullPs =
      browserResult.downloadedDocs.length > 0 ||
      browserResult.rawText.includes('person specification') ||
      browserResult.rawText.includes('essential criteria')
    const essentialCount = (browserResult.rawText.match(/\bessential\b/gi) || []).length
    return NextResponse.json({
      rawText: browserResult.rawText,
      jobTitle: browserResult.jobTitle,
      organisation: browserResult.organisation,
      jobDescription: browserResult.rawText,
      personSpec: '',
      source: 'browser',
      hasAttachedPs: browserResult.downloadedDocs.length > 0,
      likelySparsePs: !hasFullPs && essentialCount < 8,
      downloadedDocs: browserResult.downloadedDocs,
    })
  }

  // ── Step 3: External Railway scraper (fallback for non-NHS or browser failure) ─
  if (SCRAPER_URL && SCRAPER_SECRET) {
    const cleanUrl = url.split('?')[0]
    let response: Response
    try {
      response = await fetch(`${SCRAPER_URL}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-scraper-secret': SCRAPER_SECRET },
        body: JSON.stringify({ url: cleanUrl }),
        signal: AbortSignal.timeout(50000),
      })
    } catch {
      return NextResponse.json(
        { error: 'Could not read this job page automatically. Please use "Paste Job Description" instead.' },
        { status: 504 }
      )
    }

    if (response.ok) {
      const data = await response.json()
      if (data.rawText && data.rawText.length > 300 && hasJobContent((data.rawText as string).toLowerCase())) {
        const essentialCount = ((data.rawText as string).match(/\bessential\b/gi) || []).length
        const hasFullPs = data.rawText.includes('=== ATTACHED PERSON SPECIFICATION')
        return NextResponse.json({
          ...data,
          hasAttachedPs: hasFullPs,
          likelySparsePs: !hasFullPs && essentialCount < 8,
        })
      }
    }
  }

  return NextResponse.json(
    { error: 'Could not read this job page automatically. Please copy and paste the job description text instead.' },
    { status: 422 }
  )
}
