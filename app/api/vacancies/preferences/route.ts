import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { EmploymentType, VacancySource } from '@/lib/vacancy/types'

function isAuthorised(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-token')
  return secret === process.env.ADMIN_SECRET
}

// GET /api/vacancies/preferences — list all preferences
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('applicant_preferences')
    .select('*, client:clients(id, client_code, full_name)')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/vacancies/preferences — create or update preferences for a client
export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const {
    client_id,
    locations = [],
    bands = [],
    role_keywords = [],
    employment_type = 'any' as EmploymentType,
    sources = ['england', 'scotland', 'civil-service', 'healthjobsuk'] as VacancySource[],
    is_active = true,
    notes = '',
  } = body

  if (!client_id) {
    return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  }

  // Verify client exists
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, full_name')
    .eq('id', client_id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('applicant_preferences')
    .upsert(
      {
        client_id,
        locations: locations.map((l: string) => l.trim()).filter(Boolean),
        bands: bands.map((b: string) => b.trim()).filter(Boolean),
        role_keywords: role_keywords.map((k: string) => k.trim().toLowerCase()).filter(Boolean),
        employment_type,
        sources,
        is_active,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/vacancies/preferences?client_id=xxx — remove preferences for a client
export async function DELETE(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('applicant_preferences')
    .delete()
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
