import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/vacancies/my-links?code=NHSXXXXX
// Returns the search_links array for the given client (no admin auth required — links are not sensitive)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.toUpperCase()
  if (!code) return NextResponse.json([], { status: 200 })

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('client_code', code)
    .eq('is_active', true)
    .single()

  if (!client) return NextResponse.json([], { status: 200 })

  const { data: pref } = await supabaseAdmin
    .from('applicant_preferences')
    .select('search_links')
    .eq('client_id', client.id)
    .single()

  return NextResponse.json(pref?.search_links ?? [])
}
