import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * /admin – nincs 404: bejelentkezve → dashboard, különben → login.
 * Így a gulumen.com/admin címen mindig elérhető az admin (belépés vagy áttekintés).
 */
export default async function AdminRootPage() {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get('admin_authorized')?.value === '1'
  if (isAdmin) redirect('/admin/dashboard')
  redirect('/admin/login')
}
