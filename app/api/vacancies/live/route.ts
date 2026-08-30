import { verifyAdminToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'


export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    console.warn('VACANCIES LIVE: unauthorised request (token mismatch or missing)')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('nhs_vacancies')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('VACANCIES LIVE: Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`VACANCIES LIVE: returning ${(data ?? []).length} rows`)
  return NextResponse.json(data ?? [])
}
