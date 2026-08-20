import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminPermission } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { isDbConfigured } from '@/lib/prisma'
import {
  DEFAULT_PROFILE_AVATARS,
  buildProfileAvatarCatalog,
  getAdminAvatarExtraUrls,
  setAdminAvatarExtraUrls,
} from '@/lib/profile-avatars'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  extraUrls: z.array(z.string()).max(16),
})

/** GET /api/admin/settings/avatars – chat/profil avatar alapkészlet. */
export async function GET() {
  const gate = await requireAdminPermission('settings:write')
  if (!gate.ok) return gate.response

  const extraUrls = isDbConfigured() ? await getAdminAvatarExtraUrls() : []
  return NextResponse.json({
    defaults: DEFAULT_PROFILE_AVATARS.map(({ id, url }) => ({ id, url })),
    extraUrls,
    catalog: buildProfileAvatarCatalog(extraUrls).map(({ id, url, source }) => ({ id, url, source })),
    ...(!isDbConfigured()
      ? { message: 'Adatbázis nincs konfigurálva; extra képek mentése nem elérhető.' }
      : {}),
  })
}

/** PATCH /api/admin/settings/avatars – admin extra profilképek mentése. */
export async function PATCH(request: Request) {
  const gate = await requireAdminPermission('settings:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const extraUrls = await setAdminAvatarExtraUrls(parsed.data.extraUrls)
    await logAdminAction({
      action: 'profile_avatars_update',
      success: true,
      details: { extraCount: extraUrls.length },
      request,
    })
    return NextResponse.json({
      extraUrls,
      catalog: buildProfileAvatarCatalog(extraUrls),
    })
  } catch (e) {
    console.error('[api/admin/settings/avatars] PATCH', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
