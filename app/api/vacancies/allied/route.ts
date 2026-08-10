import { NextResponse } from 'next/server'
import { getVacanciesByGroup } from '@/lib/vacancies-db'

export const runtime = 'nodejs'

export function GET() {
  const vacancies = getVacanciesByGroup('allied', 50)
  return NextResponse.json(vacancies)
}
