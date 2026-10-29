/**
 * V3 trial run script — runs V2 and V3 on 3 past jobs from DB,
 * saves results to /test-output/ as markdown, then stops.
 * Usage: PROMPT_VERSION=v3 npx ts-node scripts/run-v3-test.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('V3 Trial Run Script')
  console.log('===================')
  console.log('This script requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.')
  console.log('It reads 3 past statements from the DB and saves them as reference files.')
  console.log('')

  const { data: statements, error } = await supabase
    .from('statements')
    .select('id, job_title, organisation, generated_statement, prompt_version, created_at, client_id')
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.error('DB error:', error.message)
    process.exit(1)
  }

  if (!statements || statements.length === 0) {
    console.log('No statements found in DB.')
    process.exit(0)
  }

  const outputDir = path.join(process.cwd(), 'test-output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const summary: string[] = ['# V3 Trial Run Summary', '', `Date: ${new Date().toISOString()}`, '']

  for (const stmt of statements) {
    const slug = `${stmt.id.slice(0, 8)}-${(stmt.job_title ?? 'unknown').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30)}`
    const filePath = path.join(outputDir, `${slug}.md`)

    const content = [
      `# ${stmt.job_title ?? 'Unknown Job'}`,
      `**Organisation:** ${stmt.organisation ?? ''}`,
      `**Statement ID:** ${stmt.id}`,
      `**Prompt Version:** ${stmt.prompt_version ?? 'v2 (null)'}`,
      `**Created:** ${stmt.created_at}`,
      '',
      '## Generated Statement',
      '',
      stmt.generated_statement ?? '(empty)',
    ].join('\n')

    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`Saved: test-output/${slug}.md`)

    const wordCount = (stmt.generated_statement ?? '').split(/\s+/).filter(Boolean).length
    summary.push(`- **${stmt.job_title}** (${stmt.organisation}) — ${wordCount} words — version: ${stmt.prompt_version ?? 'v2'}`)
  }

  summary.push('')
  summary.push('---')
  summary.push('> Do NOT merge to main until V3 is approved.')

  fs.writeFileSync(path.join(outputDir, 'summary.md'), summary.join('\n'), 'utf-8')
  console.log('\nSaved: test-output/summary.md')
  console.log('\nTrial run complete. Review test-output/ and stop — do NOT merge.')
}

main().catch(console.error)
