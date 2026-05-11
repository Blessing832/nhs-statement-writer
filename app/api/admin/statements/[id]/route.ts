import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

const BASE_SELECT = `
  id,
  job_title,
  organisation,
  vacancy_url,
  generated_statement,
  key_duties,
  is_rewrite,
  rewrite_instruction,
  created_at,
  client:clients(id, client_code, full_name)
`

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params

  // Try with pasted_person_spec (requires migration)
  const { data, error } = await supabaseAdmin
    .from('statements')
    .select(`${BASE_SELECT}, pasted_person_spec`)
    .eq('id', id)
    .single()

  if (!error) {
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  // Column doesn't exist yet — fall back without it
  const { data: fallback, error: fallbackError } = await supabaseAdmin
    .from('statements')
    .select(BASE_SELECT)
    .eq('id', id)
    .single()

  if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 })
  if (!fallback) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...fallback, pasted_person_spec: null })
}
