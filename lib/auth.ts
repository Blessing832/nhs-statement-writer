import { NextRequest } from 'next/server'

export function verifyAdminToken(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')
  return token === process.env.ADMIN_SECRET
}
