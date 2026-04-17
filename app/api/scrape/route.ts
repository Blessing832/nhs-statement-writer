import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL!
const SCRAPER_SECRET = process.env.SCRAPER_SECRET!

export async function POST(req: NextRequest) {
  const { client_code, url } = await req.json()

  if (!url || !client_code) {
    return NextResponse.json({ error: 'URL and client code are required' }, { status: 400 })
  }

  // Validate client before scraping
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

  // Scrape
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

  // Detect cookie/privacy/login pages returned instead of the real job advert
  const t = (data.rawText as string).toLowerCase()
  const looksLikeCookiePage =
    t.includes('cookies on nhs jobs') ||
    t.includes('manage your cookies') ||
    t.includes('cookie preferences') ||
    (t.includes('privacy notice') && !t.includes('person specification') && !t.includes('essential criteria') && !t.includes('job description'))

  const hasJobContent =
    t.includes('person specification') ||
    t.includes('essential criteria') ||
    t.includes('desirable criteria') ||
    t.includes('job description') ||
    t.includes('main duties') ||
    t.includes('key responsibilities') ||
    t.includes('band ') ||
    t.includes('nhs trust') ||
    t.includes('foundation trust')

  if (looksLikeCookiePage || (data.rawText.length < 3000 && !hasJobContent)) {
    return NextResponse.json(
      {
        error:
          'The job page returned a cookie consent or privacy page instead of the job advert. Please switch to "Paste Job Description" — open the vacancy in your browser, select all the text (Ctrl+A), copy it (Ctrl+C), and paste it into the text box.',
      },
      { status: 422 }
    )
  }

  return NextResponse.json(data)
}
