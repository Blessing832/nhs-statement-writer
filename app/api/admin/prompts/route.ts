import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getEnglandWalesPrompt } from '@/lib/prompts/england-wales'
import { getScotlandPrompt } from '@/lib/prompts/scotland'
import { verifyAdminToken as verifyAdmin } from '@/lib/auth'

// GET — return both prompts (custom if saved, else code default)
export async function GET() {
  const { data } = await supabaseAdmin.from('prompts').select('region, content, updated_at')

  const result: Record<string, { content: string; isCustom: boolean; updatedAt?: string }> = {
    'england-wales': { content: getEnglandWalesPrompt('1'), isCustom: false },
    scotland: { content: getScotlandPrompt('1'), isCustom: false },
  }

  for (const row of data ?? []) {
    if (row.region === 'england-wales' || row.region === 'scotland') {
      result[row.region] = { content: row.content, isCustom: true, updatedAt: row.updated_at }
    }
  }

  return NextResponse.json(result)
}

// POST — save a custom prompt
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { region, content } = await req.json()

  if (!region || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'region and content are required' }, { status: 400 })
  }

  if (!['england-wales', 'scotland'].includes(region)) {
    return NextResponse.json({ error: 'region must be england-wales or scotland' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('prompts')
    .upsert({ region, content: content.trim(), updated_at: new Date().toISOString() }, { onConflict: 'region' })

  if (error) {
    // If the table doesn't exist yet, return a helpful error
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'The prompts table does not exist in Supabase yet. Run the SQL migration first.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE — reset a prompt back to code default
export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { region } = await req.json()

  if (!['england-wales', 'scotland'].includes(region)) {
    return NextResponse.json({ error: 'region must be england-wales or scotland' }, { status: 400 })
  }

  await supabaseAdmin.from('prompts').delete().eq('region', region)

  return NextResponse.json({ success: true })
}
