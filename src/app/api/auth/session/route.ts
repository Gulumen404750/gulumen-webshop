import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

/**
 * GET /api/auth/session – kliens ezt hívja (pl. AuthContext) a bejelentkezés állapotának lekérdezéséhez.
 * Cookie alapján visszaadja a user adatokat vagy 401.
 */
export async function GET(request: Request) {
  const limit = await rateLimit(request, { preset: 'auth' })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
      user: { id: session.userId, email: session.email },
      provider: session.provider ?? 'credentials',
      isNewUser: session.isNewUser === true,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
