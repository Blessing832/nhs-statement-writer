import Anthropic from '@anthropic-ai/sdk'
import { Client, ScrapeResult } from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function generateStatement(
  client: Client,
  jobData: ScrapeResult,
  instructions?: string
): Promise<{ statement: string; duties: string[] }> {
  const systemPrompt = `You are an expert NHS and UK Civil Service job application writer with 15+ years of experience.
You write compelling, highly tailored supporting statements that get candidates shortlisted.

Your statements:
- Directly address each essential and desirable criterion from the person specification
- Use the NHS/Civil Service language and terminology naturally
- Follow a clear, professional structure
- Are honest and based only on the client's actual experience
- Are typically 500-800 words unless the job specifies otherwise
- Never use generic phrases — every sentence is specific to this candidate and this role`

  const userPrompt = `Write a supporting statement for the following job application.

## JOB DETAILS
Title: ${jobData.jobTitle}
Organisation: ${jobData.organisation}

## JOB DESCRIPTION & PERSON SPECIFICATION
${jobData.rawText}

## CLIENT PROFILE
Name: ${client.full_name}

Work History:
${client.work_history}

Qualifications:
${client.qualifications}

Skills:
${client.skills}

Background & Special Information (NHS experience, tools, projects, volunteer work):
${client.background}

${instructions ? `## ADDITIONAL INSTRUCTIONS FROM ADMINISTRATOR\n${instructions}` : ''}

## YOUR TASK
1. Write a strong, tailored supporting statement for this candidate
2. List the key duties and responsibilities of this role (bullet points)

Format your response as JSON with this exact structure:
{
  "statement": "the full supporting statement text here",
  "duties": ["duty 1", "duty 2", "duty 3", ...]
}`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  // Extract JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse Claude response')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    statement: parsed.statement,
    duties: parsed.duties,
  }
}
