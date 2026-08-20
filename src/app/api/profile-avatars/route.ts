import { NextResponse } from 'next/server'
import { getProfileAvatarCatalog } from '@/lib/profile-avatars'

export const dynamic = 'force-dynamic'

/** GET /api/profile-avatars – publikus alap + admin extra profilképek. */
export async function GET() {
  try {
    const catalog = await getProfileAvatarCatalog()
    return NextResponse.json({
      avatars: catalog.map(({ id, url }) => ({ id, url })),
    })
  } catch (e) {
    console.error('[api/profile-avatars] GET', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
