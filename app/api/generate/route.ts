import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateStatement } from '@/lib/claude'
import { ScrapeResult } from '@/lib/types'

export const maxDuration = 60

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL!
const SCRAPER_SECRET = process.env.SCRAPER_SECRET!

// Helper to send an SSE event
function sseEvent(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

export async function POST(req: NextRequest) {
  const {
    client_code,
    vacancy_url,
    instructions,
    style,
    specificQuestions,
    rewriteInstruction,
    previousStatement,
  } = await req.json()

  if (!client_code || !vacancy_url) {
    return NextResponse.json({ error: 'Client code and vacancy URL are required' }, { status: 400 })
  }

  // Return a streaming SSE response
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => sseEvent(controller, data)

      try {
        // 1. Look up client
        send({ type: 'progress', message: 'Verifying your access...' })

        const { data: client, error: clientError } = await supabaseAdmin
          .from('clients')
          .select('*')
          .eq('client_code', client_code.toUpperCase())
          .eq('is_active', true)
          .single()

        if (clientError || !client) {
          send({ type: 'error', error: 'Invalid or inactive client code' })
          controller.close()
          return
        }

        const now = new Date()
        const subEnd = new Date(client.subscription_end)
        if (now > subEnd) {
          send({ type: 'error', error: 'Your subscription has expired. Please contact the administrator.' })
          controller.close()
          return
        }

        // 2. Scrape
        send({ type: 'progress', message: 'Reading the job advert...' })

        const scrapeRes = await fetch(`${SCRAPER_URL}/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-scraper-secret': SCRAPER_SECRET,
          },
          body: JSON.stringify({ url: vacancy_url }),
          signal: AbortSignal.timeout(28000),
        })

        if (!scrapeRes.ok) {
          const scrapeErr = await scrapeRes.json().catch(() => ({ error: 'Failed to read job advert' }))
          send({ type: 'error', error: `Could not read the job advert page. Please check the URL is correct and try again. (${scrapeErr.error})` })
          controller.close()
          return
        }

        const jobData: ScrapeResult = await scrapeRes.json()

        if (!jobData.rawText || jobData.rawText.length < 100) {
          send({ type: 'error', error: 'Could not extract enough information from the job advert. Please check the URL.' })
          controller.close()
          return
        }

        send({ type: 'progress', message: 'Extracting person spec criteria and job keywords...' })

        // Small delay so user sees the message
        await new Promise((r) => setTimeout(r, 300))

        send({ type: 'progress', message: 'Writing your supporting statement...' })

        // 3. Generate
        const { statement, previousRoleDuties, currentRoleDuties, analysis, promptRegion } =
          await generateStatement(client, jobData, {
            instructions,
            style: style || '1',
            specificQuestions,
            rewriteInstruction,
            previousStatement,
            vacancyUrl: vacancy_url,
          })

        // 4. Save to DB
        await supabaseAdmin.from('statements').insert({
          client_id: client.id,
          vacancy_url,
          job_title: jobData.jobTitle,
          organisation: jobData.organisation,
          generated_statement: statement,
          key_duties: currentRoleDuties.length > 0 ? currentRoleDuties : (analysis?.keyDuties || []),
          is_rewrite: !!rewriteInstruction,
          rewrite_instruction: rewriteInstruction || null,
        })

        // 5. Send complete
        send({
          type: 'complete',
          statement,
          previousRoleDuties,
          currentRoleDuties,
          analysis,
          promptRegion,
          jobTitle: jobData.jobTitle,
          organisation: jobData.organisation,
          source: jobData.source,
        })

        controller.close()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('Generate error:', message)

        if (
          message.toLowerCase().includes('credit') ||
          message.toLowerCase().includes('billing') ||
          message.toLowerCase().includes('balance') ||
          message.toLowerCase().includes('quota') ||
          message.toLowerCase().includes('overloaded')
        ) {
          send({ type: 'error', error: 'The statement writer is temporarily unavailable. Please contact your administrator.' })
        } else if (
          message.toLowerCase().includes('timeout') ||
          message.toLowerCase().includes('timed out') ||
          message.toLowerCase().includes('abort')
        ) {
          send({ type: 'error', error: 'The job advert page took too long to load. Please try again in a moment.' })
        } else {
          send({ type: 'error', error: message })
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
