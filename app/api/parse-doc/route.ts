import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return (data.text as string) || ''
  } catch {
    return ''
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch {
    return ''
  }
}

async function parseDoc(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WordExtractor = require('word-extractor')
    const extractor = new WordExtractor()
    const doc = await extractor.extract(buffer)
    return doc.getBody() || ''
  } catch {
    return ''
  }
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

    const isPdf = type.includes('pdf') || name.endsWith('.pdf')
    const isDocx = type.includes('wordprocessingml') || name.endsWith('.docx')
    const isOldDoc = (name.endsWith('.doc') && !name.endsWith('.docx')) ||
                     (type.includes('msword') && !type.includes('wordprocessingml'))

    let text = ''

    if (isPdf) {
      text = await parsePdf(buffer)
      if (!text || text.length < 50) text = await parseDocx(buffer)
    } else if (isDocx) {
      text = await parseDocx(buffer)
      if (!text || text.length < 50) text = await parsePdf(buffer)
    } else if (isOldDoc) {
      text = await parseDoc(buffer)
      if (!text || text.length < 50) text = await parsePdf(buffer)
    } else {
      text = await parsePdf(buffer)
      if (!text || text.length < 50) text = await parseDocx(buffer)
      if (!text || text.length < 50) text = await parseDoc(buffer)
    }

    console.log(`[parse-doc] extracted ${text.length} chars`)

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract text from this file. Please try saving as PDF or .docx, or paste the text manually.' },
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
