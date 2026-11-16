import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('clients').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // Only update the fields that were sent, so a partial save (for example one
  // instruction from the bulk page) can never blank the rest of the profile.
  const FIELDS = [
    'full_name', 'work_history', 'qualifications', 'skills', 'background',
    'special_instructions', 'opening_style', 'scotland_q2_variation',
    'subscription_end', 'is_active',
    'q_difficult_situation', 'q_why_trust', 'q_colleagues_say', 'q_proudest_moment', 'q_skills_equipment',
  ] as const
  const baseUpdate: Record<string, unknown> = {}
  for (const f of FIELDS) {
    if (body[f] !== undefined) baseUpdate[f] = body[f]
  }
  if (Object.keys(baseUpdate).length === 0 && body.statement_limit === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Try with statement_limit; fall back silently if the column doesn't exist yet
  let { data, error } = await supabaseAdmin
    .from('clients')
    .update(body.statement_limit !== undefined ? { ...baseUpdate, statement_limit: body.statement_limit } : baseUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error?.message?.includes('statement_limit')) {
    ;({ data, error } = await supabaseAdmin
      .from('clients')
      .update(baseUpdate)
      .eq('id', id)
      .select()
      .single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params

  // Delete statements first, then client
  await supabaseAdmin.from('statements').delete().eq('client_id', id)
  const { error } = await supabaseAdmin.from('clients').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
