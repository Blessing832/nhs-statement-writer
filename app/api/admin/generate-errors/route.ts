import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const since = new Date()
  since.setHours(since.getHours() - 24)

  const { data, count } = await supabaseAdmin
    .from('generate_errors')
    .select('id, created_at, client_code, error_type, http_status', { count: 'exact' })
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ count: count ?? 0, recent: data ?? [] })
}
