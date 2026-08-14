import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-session'
import { getAdminUrlSlug, publicAdminUiPath } from '@/lib/admin-url'

/**
 * /admin (vagy /{ADMIN_URL_SLUG}) – bejelentkezve → dashboard, különben → login.
 */
export default async function AdminRootPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const isAdmin = await verifyAdminSessionToken(token)
  const slug = getAdminUrlSlug()
  if (isAdmin) redirect(publicAdminUiPath('/admin/dashboard', slug))
  redirect(publicAdminUiPath('/admin/login', slug))
}
