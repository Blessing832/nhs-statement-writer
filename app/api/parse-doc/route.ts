import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

async function parsePdf(buffer: Buffer): Promise<string> {
  // Require the internal module directly — avoids pdf-parse trying to load
  // test fixture files (./test/data/...) which don't exist in production builds
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  return (data.text as string) || ''
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value || ''
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const name = file.name.toLowerCase()
    const type = (file.type || '').toLowerCase()

    console.log(`[parse-doc] file="${file.name}" type="${type}" size=${buffer.length}`)

    let text = ''
    const isPdf = type.includes('pdf') || name.endsWith('.pdf')
    const isDocx = type.includes('wordprocessingml') || type.includes('msword') || name.endsWith('.docx') || name.endsWith('.doc')

    if (isPdf) {
      try { text = await parsePdf(buffer) } catch { /* fall through */ }
      if (!text || text.length < 100) {
        try { text = await parseDocx(buffer) } catch { /* not a valid DOCX */ }
      }
    } else if (isDocx) {
      try { text = await parseDocx(buffer) } catch { /* old .doc or corrupt — try PDF */ }
      if (!text || text.length < 100) {
        try { text = await parsePdf(buffer) } catch { /* not a PDF either */ }
      }
    } else {
      try { text = await parsePdf(buffer) } catch { /* not a PDF */ }
      if (!text || text.length < 100) {
        try { text = await parseDocx(buffer) } catch { /* not a DOCX */ }
      }
    }

    console.log(`[parse-doc] extracted ${text.length} chars`)

    if (!text || text.trim().length < 50) {
      const isOldDoc = name.endsWith('.doc') && !name.endsWith('.docx')
      return NextResponse.json(
        {
          error: isOldDoc
            ? 'Old .doc files cannot always be read. Please open the file in Word and save it as .docx or PDF, then upload again.'
            : 'Could not extract text from this file. Please try saving as PDF or .docx, or paste the text manually.',
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ text: text.trim() })
  } catch (err) {
    console.error('[parse-doc] error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to parse file: ${message}` }, { status: 500 })
  }
}
