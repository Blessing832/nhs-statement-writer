import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, shortlisted, interview } = await req.json()

  if (!id) {
    return NextResponse.json({ error: 'Missing statement id' }, { status: 400 })
  }

  const validValues = [null, 'yes', 'no']
  if (shortlisted !== undefined && !validValues.includes(shortlisted)) {
    return NextResponse.json({ error: 'shortlisted must be null, "yes" or "no"' }, { status: 400 })
  }
  if (interview !== undefined && !validValues.includes(interview)) {
    return NextResponse.json({ error: 'interview must be null, "yes" or "no"' }, { status: 400 })
  }

  const updates: Record<string, string | null> = {}
  if (shortlisted !== undefined) updates.shortlisted = shortlisted
  if (interview !== undefined) updates.interview = interview

  const { error } = await supabaseAdmin
    .from('statements')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
