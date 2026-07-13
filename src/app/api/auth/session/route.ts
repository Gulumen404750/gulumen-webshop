import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

/**
 * GET /api/auth/session – kliens ezt hívja (pl. AuthContext) a bejelentkezés állapotának lekérdezéséhez.
 * Cookie alapján visszaadja a user adatokat vagy 401.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
      user: { id: session.userId, email: session.email },
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
