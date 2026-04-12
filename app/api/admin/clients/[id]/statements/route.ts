import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('statements')
    .select('id, vacancy_url, job_title, organisation, is_rewrite, rewrite_instruction, created_at')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flag URLs that have been rewritten more than twice
  const urlCounts: Record<string, number> = {}
  for (const s of data || []) {
    urlCounts[s.vacancy_url] = (urlCounts[s.vacancy_url] || 0) + 1
  }

  const enriched = (data || []).map((s) => ({
    ...s,
    totalForUrl: urlCounts[s.vacancy_url],
    flagged: urlCounts[s.vacancy_url] > 2,
  }))

  return NextResponse.json(enriched)
}
