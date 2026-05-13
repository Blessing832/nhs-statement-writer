import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const name = file.name.toLowerCase()
    const type = (file.type || '').toLowerCase()

    let text = ''

    if (type.includes('pdf') || name.endsWith('.pdf')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      text = data.text || ''
    } else if (
      type.includes('wordprocessingml') || type.includes('msword') ||
      name.endsWith('.docx') || name.endsWith('.doc')
    ) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value || ''
    } else {
      // Unknown — try PDF then DOCX
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buffer)
        if (data.text && data.text.length > 100) text = data.text
      } catch { /* not a PDF */ }
      if (!text) {
        try {
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ buffer })
          text = result.value || ''
        } catch { /* not a DOCX */ }
      }
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract text from this file. Please try a different format.' }, { status: 422 })
    }

    return NextResponse.json({ text: text.trim() })
  } catch (err) {
    console.error('parse-doc error:', err)
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }
}
