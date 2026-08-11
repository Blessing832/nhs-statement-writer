import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET ?code=X        → { [vacancy_id]: 'done'|'closed' } for that client (unauthenticated)
// GET ?all=1         → all rows (requires x-admin-token header)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const all  = req.nextUrl.searchParams.get('all') === '1'

  if (all) {
    if (req.headers.get('x-admin-token') !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    const { data, error } = await supabaseAdmin
      .from('vacancy_tracking')
      .select('client_code, vacancy_id, vacancy_title, status, marked_at')
      .order('marked_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  if (!code) return NextResponse.json({})
  const { data } = await supabaseAdmin
    .from('vacancy_tracking')
    .select('vacancy_id, status')
    .eq('client_code', code)
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.vacancy_id] = row.status
  return NextResponse.json(map)
}

// POST { client_code, vacancy_id, vacancy_title, status }
// status = '' clears the entry; status = 'done'|'closed' upserts it
export async function POST(req: NextRequest) {
  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_code, vacancy_id, vacancy_title, status } = body
  if (!client_code || !vacancy_id) {
    return NextResponse.json({ error: 'client_code and vacancy_id required' }, { status: 400 })
  }

  if (!status) {
    await supabaseAdmin.from('vacancy_tracking').delete()
      .eq('client_code', client_code).eq('vacancy_id', vacancy_id)
    return NextResponse.json({ ok: true })
  }

  if (!['done', 'closed'].includes(status)) {
    return NextResponse.json({ error: 'status must be done or closed' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('vacancy_tracking')
    .upsert(
      { client_code, vacancy_id, vacancy_title, status, marked_at: new Date().toISOString() },
      { onConflict: 'client_code,vacancy_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
