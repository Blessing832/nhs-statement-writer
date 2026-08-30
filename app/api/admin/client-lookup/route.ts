import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  // If it looks like a code (no spaces, mostly uppercase), try exact code match first
  const looksLikeCode = /^[A-Z0-9]{4,}$/i.test(q.replace(/\s/g, ''))

  if (looksLikeCode) {
    const { data } = await supabaseAdmin
      .from('clients')
      .select('id, client_code, full_name, is_active, subscription_end')
      .eq('client_code', q.toUpperCase())
      .limit(1)

    if (data && data.length > 0) {
      return NextResponse.json({ clients: data })
    }
  }

  // Name search (case-insensitive partial match)
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, client_code, full_name, is_active, subscription_end')
    .ilike('full_name', `%${q}%`)
    .order('full_name')
    .limit(10)

  if (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  return NextResponse.json({ clients: data ?? [] })
}
