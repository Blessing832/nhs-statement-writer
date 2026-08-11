import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Unauthenticated diagnostic endpoint — returns row count and sample rows from nhs_vacancies
export async function GET() {
  const { count, error: countErr } = await supabaseAdmin
    .from('nhs_vacancies')
    .select('*', { count: 'exact', head: true })

  const { data: sample, error: sampleErr } = await supabaseAdmin
    .from('nhs_vacancies')
    .select('id, title, employer, scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    row_count: count ?? 0,
    count_error: countErr?.message ?? null,
    sample_rows: sample ?? [],
    sample_error: sampleErr?.message ?? null,
  })
}
