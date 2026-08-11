import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Public (unauthenticated) endpoint — returns current vacancies for the client portal.
// No date filter needed: the ingest route purges previous-day rows after every scrape,
// so whatever is in the table is already today's data.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('nhs_vacancies')
    .select('id, title, employer, location, band, contract_type, closing_date, url, scraped_at, date_posted')
    .order('scraped_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
