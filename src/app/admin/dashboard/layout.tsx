import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * Node-oldali session + epoch ellenőrzés: jelszóreset után a régi JWT
 * Redis nélkül sem éri el a dashboardot (az Edge middleware Redis híján csak az sv-t nézi).
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ok = await requireAdmin()
  if (!ok) redirect('/admin/login')
  return <>{children}</>
}
