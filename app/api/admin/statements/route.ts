import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  const { data, error } = await supabaseAdmin
    .from('statements')
    .select(`
      id,
      job_title,
      organisation,
      vacancy_url,
      is_rewrite,
      created_at,
      pasted_person_spec,
      client:clients(id, client_code, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return spec_pasted boolean and word count — not the full text — to keep the list payload small
  const mapped = (data || []).map(({ pasted_person_spec, ...rest }) => ({
    ...rest,
    spec_pasted: !!(pasted_person_spec?.trim()),
    spec_word_count: pasted_person_spec?.trim()
      ? pasted_person_spec.trim().split(/\s+/).length
      : 0,
  }))

  return NextResponse.json(mapped)
}
