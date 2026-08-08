import { NextResponse } from 'next/server'
import { confirmMarketingOptIn } from '@/lib/marketing-consent'
import { isDbConfigured } from '@/lib/prisma'

/** GET /api/newsletter/confirm?email=... – double opt-in. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim() ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.redirect(`${appUrl}/?newsletter=invalid`)
  }

  if (!isDbConfigured()) {
    return NextResponse.redirect(`${appUrl}/?newsletter=ok`)
  }

  const ok = await confirmMarketingOptIn(email)
  return NextResponse.redirect(`${appUrl}/?newsletter=${ok ? 'confirmed' : 'invalid'}`)
}
