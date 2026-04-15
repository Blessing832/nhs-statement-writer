import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { DashboardData, DashboardApplicant, Vacancy } from '@/lib/vacancy/types'

function isAuthorised(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-token')
  return secret === process.env.ADMIN_SECRET
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // All clients with active preferences
  const { data: allPrefs } = await supabaseAdmin
    .from('applicant_preferences')
    .select('client_id, clients(id, client_code, full_name)')
    .eq('is_active', true)

  // All pending matches — load them then filter in JS
  const { data: rawMatches } = await supabaseAdmin
    .from('vacancy_matches')
    .select(`
      id,
      client_id,
      status,
      vacancy:vacancies(
        id, external_id, source, title, organisation,
        location, band, employment_type, url,
        posted_at, closes_at, is_open, last_checked_at, created_at
      )
    `)
    .eq('status', 'pending')

  // Filter in JS: vacancy must be open and posted within 48h (or no posted date)
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const matches = (rawMatches || []).filter((m) => {
    const v = m.vacancy as unknown as Vacancy | null
    if (!v) return false
    if (!v.is_open) return false
    if (v.posted_at && new Date(v.posted_at) < cutoff48h) return false
    return true
  })

  // Last scan time
  const { data: lastScan } = await supabaseAdmin
    .from('scan_log')
    .select('scanned_at, new_matches_found')
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Build per-client match map
  const clientMatchMap = new Map<string, typeof matches>()
  for (const match of matches) {
    if (!clientMatchMap.has(match.client_id)) clientMatchMap.set(match.client_id, [])
    clientMatchMap.get(match.client_id)!.push(match)
  }

  const needsAction: DashboardApplicant[] = []
  const allClear: { client_id: string; client_code: string; full_name: string }[] = []

  for (const pref of allPrefs || []) {
    const client = pref.clients as { id: string; client_code: string; full_name: string } | null
    if (!client) continue

    const clientMatches = clientMatchMap.get(pref.client_id) || []

    if (clientMatches.length > 0) {
      needsAction.push({
        client_id: pref.client_id,
        client_code: client.client_code,
        full_name: client.full_name,
        pending_count: clientMatches.length,
        matches: clientMatches.map((m) => ({
          match_id: m.id,
          vacancy: m.vacancy as unknown as Vacancy,
        })),
      })
    } else {
      allClear.push({
        client_id: pref.client_id,
        client_code: client.client_code,
        full_name: client.full_name,
      })
    }
  }

  // Sort needs_action by most matches first
  needsAction.sort((a, b) => b.pending_count - a.pending_count)

  const { count: totalOpen } = await supabaseAdmin
    .from('vacancies')
    .select('id', { count: 'exact', head: true })
    .eq('is_open', true)

  const data: DashboardData = {
    needs_action: needsAction,
    all_clear: allClear,
    last_scan_at: lastScan?.scanned_at || null,
    new_this_scan: lastScan?.new_matches_found || 0,
    total_open_vacancies: totalOpen || 0,
  }

  return NextResponse.json(data)
}
