import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('statements')
    .select(`
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
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
