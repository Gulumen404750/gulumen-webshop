import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-session'

/**
 * /admin – bejelentkezve → dashboard, különben → login.
 */
export default async function AdminRootPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const isAdmin = await verifyAdminSessionToken(token)
  if (isAdmin) redirect('/admin/dashboard')
  redirect('/admin/login')
}
