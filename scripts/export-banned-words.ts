/**
 * Exports banned words to banned_words_export.csv
 * Usage: npx ts-node scripts/export-banned-words.ts
 */
import { scanBanned } from '../lib/bannedWords'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Exports the static banned pattern word list plus DB rows
async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: dbRows } = await supabase.from('banned_words').select('word, replacement, enabled')

  // Get static pattern words by scanning a representative text containing each word
  const staticWords: string[] = []
  const testStatements = [
    'I demonstrate robust holistic comprehensive passionate dedicated hardworking grounded seamlessly crucial vital notably moreover furthermore additionally proactive dynamic enthusiastic compassionate paramount pivotal integral imperative adept multifaceted nuanced bespoke tremendously immensely substantially bustling vibrant daunting overarching impactful transformative synergy plethora realm tapestry landscape',
    'I would ensure highly motivated central to at all times in order to with regard to in relation to due to the fact that going forward moving forward touch base not only not just more than just significantly improved greatly improved substantially improved proven track record fast-paced environment attention to detail team player think outside the box results-driven go above and beyond invaluable experience from day one from the first shift',
    'This resulted in this led to as a result I would bring I would contribute I would strive I believe I would I am confident that I am deeply committed I genuinely believe I truly care',
    'demonstrate ensure utilise utilizes encompass facilitate enhance maintain implement foster leverage cultivate streamline liaise collaborate optimise mitigate empower uphold endeavour aspire shape span reflect delve unlock unveil elevate nestle blend',
  ]
  for (const stmt of testStatements) {
    const hits = scanBanned(stmt)
    for (const hit of hits) {
      if (!staticWords.includes(hit.word)) staticWords.push(hit.word)
    }
  }

  const lines = ['word,replacement,enabled,source']
  for (const w of staticWords) {
    lines.push(`"${w}",,true,static`)
  }
  for (const row of dbRows ?? []) {
    lines.push(`"${row.word}","${row.replacement ?? ''}",${row.enabled},database`)
  }

  fs.writeFileSync('banned_words_export.csv', lines.join('\n'), 'utf-8')
  console.log(`Exported ${lines.length - 1} banned words to banned_words_export.csv`)
}

main().catch(console.error)
