import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdminToken as verifyAdmin } from '@/lib/auth'

// GET — list all paragraph openers
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('paragraph_openers')
    .select('*')
    .order('set_number')
    .order('position')

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'The paragraph_openers table does not exist. Run the SQL migration first.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// POST — add a new opener
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { set_number, position, text } = await req.json()

  if (!set_number || !position || !text?.trim()) {
    return NextResponse.json({ error: 'set_number, position and text are required' }, { status: 400 })
  }

  if (![1, 2].includes(Number(set_number))) {
    return NextResponse.json({ error: 'set_number must be 1 or 2' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('paragraph_openers')
    .insert({ set_number: Number(set_number), position: Number(position), text: text.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — edit text or toggle enabled
export async function PATCH(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, text, enabled } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (typeof text === 'string') updates.text = text.trim()
  if (typeof enabled === 'boolean') updates.enabled = enabled

  const { error } = await supabaseAdmin
    .from('paragraph_openers')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — remove an opener
export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('paragraph_openers')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
