import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

const BASE_SELECT = `
  id,
  job_title,
  organisation,
  vacancy_url,
  is_rewrite,
  created_at,
  client:clients(id, client_code, full_name)
`

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  // Try with pasted_person_spec first (requires migration to have been run)
  const { data, error } = await supabaseAdmin
    .from('statements')
    .select(`${BASE_SELECT}, pasted_person_spec`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!error) {
    const mapped = (data || []).map(({ pasted_person_spec, ...rest }) => ({
      ...rest,
      spec_pasted: !!(pasted_person_spec?.trim()),
      spec_word_count: pasted_person_spec?.trim()
        ? pasted_person_spec.trim().split(/\s+/).length
        : 0,
    }))
    return NextResponse.json(mapped)
  }

  // Column doesn't exist yet (migration not run) — fall back without it
  const { data: fallback, error: fallbackError } = await supabaseAdmin
    .from('statements')
    .select(BASE_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 })

  return NextResponse.json(
    (fallback || []).map(s => ({ ...s, spec_pasted: null, spec_word_count: 0 }))
  )
}
