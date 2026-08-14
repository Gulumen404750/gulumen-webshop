import { getAdminUrlSlug } from '@/lib/admin-url'
import { AdminShell } from '@/app/admin/AdminShell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const slug = getAdminUrlSlug()
  const publicBase = slug ? `/${slug}` : '/admin'
  return <AdminShell publicBase={publicBase}>{children}</AdminShell>
}
