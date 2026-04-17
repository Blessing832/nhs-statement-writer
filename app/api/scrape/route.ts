import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as cheerio from 'cheerio'

export const maxDuration = 60

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL!
const SCRAPER_SECRET = process.env.SCRAPER_SECRET!

// Strip HTML tags and collapse whitespace
function htmlToText(html: string): string {
  const $ = cheerio.load(html)
  // Remove scripts, styles, nav, cookie banners, footers
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

// Direct server-side fetch — no JS execution, no cookie popup, works for SSR pages
async function directFetch(url: string): Promise<{ rawText: string; jobTitle: string; organisation: string } | null> {
  try {
    const cleanUrl = url.split('?')[0] // strip filter params, keep job ID
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        // Pre-accept NHS cookies so the cookie banner is never shown
        'Cookie': 'nhsuk-cookie-consent=%7B%22preferences%22%3Atrue%2C%22statistics%22%3Atrue%2C%22marketing%22%3Atrue%2C%22version%22%3A1%7D',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const rawText = htmlToText(html)
    if (rawText.length < 300 || !hasJobContent(rawText)) return null

    // Extract title from <title> or <h1>
    const $ = cheerio.load(html)
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
  // This works because we fetch raw HTML without JS execution, so no cookie popup
  const direct = await directFetch(url)
  if (direct) {
    return NextResponse.json({
      rawText: direct.rawText,
      jobTitle: direct.jobTitle,
      organisation: direct.organisation,
      jobDescription: direct.rawText,
      personSpec: '',
      source: 'direct',
    })
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

  // Detect cookie/privacy pages from the scraper response
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

  return NextResponse.json(data)
}
