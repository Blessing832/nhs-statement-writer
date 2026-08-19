import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-token') === process.env.ADMIN_SECRET
}

// GET — list all banned words
export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('banned_words')
    .select('id, word, replacement, pattern_type, enabled, created_at')
    .order('pattern_type')
    .order('word')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — add or update a banned word
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { word, replacement, pattern_type, enabled } = body

  if (!word?.trim()) return NextResponse.json({ error: 'word is required' }, { status: 400 })
  if (replacement === undefined) return NextResponse.json({ error: 'replacement is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('banned_words')
    .upsert(
      {
        word: word.trim().toLowerCase(),
        replacement: (replacement ?? '').trim(),
        pattern_type: pattern_type || 'other',
        enabled: enabled !== false,
      },
      { onConflict: 'word' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — toggle enabled or update replacement inline
export async function PATCH(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, enabled, replacement } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (enabled !== undefined) updates.enabled = enabled
  if (replacement !== undefined) updates.replacement = replacement.trim()

  const { error } = await supabaseAdmin.from('banned_words').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a banned word by id
export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('banned_words').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
