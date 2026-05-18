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

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({
      full_name: body.full_name,
      work_history: body.work_history,
      qualifications: body.qualifications,
      skills: body.skills,
      background: body.background,
      special_instructions: body.special_instructions ?? '',
      opening_style: body.opening_style ?? '',
      scotland_q2_variation: body.scotland_q2_variation ?? '',
      subscription_end: body.subscription_end,
      is_active: body.is_active,
    })
    .eq('id', id)
    .select()
    .single()

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
