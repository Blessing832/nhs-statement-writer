import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { full_name, work_history, qualifications, skills, background, special_instructions, subscription_months } = body

  if (!full_name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // Generate unique client code
  const client_code = generateClientCode()

  const start = new Date()
  const end = new Date()
  end.setMonth(end.getMonth() + (subscription_months || 1))

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      client_code,
      full_name,
      work_history: work_history || '',
      qualifications: qualifications || '',
      skills: skills || '',
      background: background || '',
      special_instructions: special_instructions || '',
      subscription_start: start.toISOString(),
      subscription_end: end.toISOString(),
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

function generateClientCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'NHS'
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
