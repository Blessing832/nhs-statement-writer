import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthorised(req: NextRequest): boolean {
  return req.headers.get('x-admin-token') === process.env.ADMIN_SECRET
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('nhs_vacancies')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
