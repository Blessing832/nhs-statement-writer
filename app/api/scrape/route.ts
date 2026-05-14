import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { scrapeJobUrl } from '@/lib/job-scraper'

// Browserless (40s) + Railway (60s) + direct fetch (15s) = up to 115s worst case
export const maxDuration = 300

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

  try {
    const result = await scrapeJobUrl(url)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not read this job page automatically. Please copy and paste the job description text instead.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
