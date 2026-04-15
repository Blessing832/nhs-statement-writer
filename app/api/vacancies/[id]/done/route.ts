import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthorised(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-token')
  return secret === process.env.ADMIN_SECRET
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id: matchId } = await params

  const { error } = await supabaseAdmin
    .from('vacancy_matches')
    .update({ status: 'done', done_at: new Date().toISOString() })
    .eq('id', matchId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
