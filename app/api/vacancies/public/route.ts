import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Public (unauthenticated) endpoint — returns today's vacancies for the client portal
export async function GET() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })

  const { data, error } = await supabaseAdmin
    .from('nhs_vacancies')
    .select('id, title, employer, location, band, contract_type, closing_date, url, scraped_at, date_posted')
    .eq('scrape_date', today)
    .order('scraped_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
