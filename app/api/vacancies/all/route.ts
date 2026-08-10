import { NextResponse } from 'next/server'
import { getAllVacancies } from '@/lib/vacancies-db'

export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json(getAllVacancies(100))
}
