import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as cheerio from 'cheerio'

export const maxDuration = 60

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL!
const SCRAPER_SECRET = process.env.SCRAPER_SECRET!

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

// Fetch an attachment URL and extract text (PDF or DOCX)
async function fetchAttachmentText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { ...BASE_HEADERS, 'Accept': 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,*/*' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ''

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    const urlLower = url.toLowerCase()

    const isPdf = contentType.includes('pdf') || urlLower.includes('.pdf')
    const isDocx = contentType.includes('wordprocessingml') || contentType.includes('msword') || urlLower.includes('.docx') || urlLower.includes('.doc')

    if (!isPdf && !isDocx) {
      // Could be a redirect to a PDF — check content-type of final response
      // If neither, skip
      return ''
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    if (isPdf) return parsePdf(buffer)
    if (isDocx) return parseDocx(buffer)
    return ''
  } catch {
    return ''
  }
}

// Find links on the page that are likely to be JDPS attachments
function findJdpsLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().toLowerCase().trim()
    const hrefLower = href.toLowerCase()

    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return

    const likelyJdps =
      text.includes('person spec') ||
      text.includes('job description') ||
      text.includes('job desc') ||
      text.includes('jdps') ||
      text.includes('jd and ps') ||
      text.includes('jd & ps') ||
      text.includes('jd/ps') ||
      text === 'jd' ||
      text.startsWith('jd ') ||
      text.includes('job spec') ||
      text.includes('job pack') ||
      text.includes('role profile') ||
      text.includes('supporting document') ||
      text.includes('supporting info') ||
      text.includes('application pack') ||
      text.includes('candidate pack') ||
      text.includes('recruitment pack') ||
      text.includes('attachment') ||
      text.includes('download') ||
      text.includes('view document') ||
      hrefLower.includes('.pdf') ||
      hrefLower.includes('.docx') ||
      hrefLower.includes('.doc') ||
      hrefLower.includes('document') ||
      hrefLower.includes('attachment') ||
      hrefLower.includes('download') ||
      // NHS Jobs uses extensionless download URLs like /candidate/jobadvert/{ref}/download/{id}
      hrefLower.includes('/download/') ||
      hrefLower.includes('/file/') ||
      hrefLower.includes('/files/')

    if (!likelyJdps) return

    try {
      const absolute = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
      links.push(absolute)
    } catch { /* invalid URL, skip */ }
  })
  return [...new Set(links)].slice(0, 4)
}

// Fetch all JDPS attachments in parallel and return combined text
async function extractAttachmentText($: cheerio.CheerioAPI, pageUrl: string): Promise<string> {
  const links = findJdpsLinks($, pageUrl)
  if (links.length === 0) return ''

  const results = await Promise.allSettled(links.map(fetchAttachmentText))
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

    // Always try to find and extract JDPS attachments to supplement the page text
    const attachmentText = await extractAttachmentText($, cleanUrl)
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
    const directHasFullPs = direct.rawText.includes('=== ATTACHED PERSON SPECIFICATION')
    const directEssentials = (direct.rawText.match(/\bessential\b/gi) || []).length
    const directSparse = !directHasFullPs && directEssentials < 8

    // For NHS job boards, a sparse direct result is not good enough — Puppeteer can
    // click hidden tabs and download the full JDPS PDF. Fall through to step 2.
    if (!directSparse || !isNhsJobSite(url)) {
      return NextResponse.json({
        rawText: direct.rawText,
        jobTitle: direct.jobTitle,
        organisation: direct.organisation,
        jobDescription: direct.rawText,
        personSpec: '',
        source: 'direct',
        hasAttachedPs: directHasFullPs,
        likelySparsePs: directSparse,
      })
    }
  }

  // ── Step 2: Fall back to external Puppeteer scraper ──────────────────────────
  let response: Response
  try {
    response = await fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scraper-secret': SCRAPER_SECRET,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(50000),
    })
  } catch {
    return NextResponse.json(
      { error: 'The job advert page took too long to load. Please check the URL and try again.' },
      { status: 504 }
    )
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Could not read job advert' }))
    return NextResponse.json({ error: err.error || 'Could not read job advert' }, { status: response.status })
  }

  const data = await response.json()

  if (!data.rawText || data.rawText.length < 100) {
    return NextResponse.json(
      { error: 'Could not extract enough text from the job advert. Please check the URL.' },
      { status: 422 }
    )
  }

  const t = (data.rawText as string).toLowerCase()
  const looksLikeCookiePage =
    t.includes('cookies on nhs jobs') ||
    t.includes('manage your cookies') ||
    t.includes('cookie preferences') ||
    (t.includes('privacy notice') && !hasJobContent(t))

  if (looksLikeCookiePage || (data.rawText.length < 3000 && !hasJobContent(t))) {
    return NextResponse.json(
      { error: 'Could not read this job page automatically. Please copy the text from the vacancy page (Ctrl+A then Ctrl+C) and use "Paste Job Description" instead.' },
      { status: 422 }
    )
  }

  // Always try to supplement with attachments. NHS Jobs shows a subset of criteria
  // on the page (often 11-15) but the full JDPS PDF typically has 25-40.
  // Issue: some job pages render attachment links via JavaScript, so a bare HTTP
  // fetch here won't find them if the Puppeteer scraper already rendered them.
  // We try anyway — if it works we get the full PS; if not, the rawText still has
  // the page criteria and we flag low coverage to the client.
  let attachmentFound = false
  try {
    const res2 = await fetch(url.split('?')[0], {
      headers: { ...BASE_HEADERS, 'Accept': 'text/html,*/*' },
      signal: AbortSignal.timeout(10000),
    })
    if (res2.ok) {
      const html2 = await res2.text()
      const $2 = cheerio.load(html2)
      const attachmentText = await extractAttachmentText($2, url.split('?')[0])
      if (attachmentText.length > 200) {
        data.rawText += '\n\n=== ATTACHED PERSON SPECIFICATION / JOB DESCRIPTION ===\n' + attachmentText
        attachmentFound = true
      }
    }
  } catch { /* non-critical */ }

  // Count rough number of essential criteria visible in the text.
  // If fewer than 15 and no attachment was found, warn the user to paste the JDPS.
  const essentialCount = ((data.rawText as string).match(/\bessential\b/gi) || []).length
  const hasFullPs = attachmentFound || data.rawText.includes('=== ATTACHED PERSON SPECIFICATION')
  const likelySparsePs = !hasFullPs && essentialCount < 8

  return NextResponse.json({
    ...data,
    hasAttachedPs: hasFullPs,
    likelySparsePs,
  })
}
