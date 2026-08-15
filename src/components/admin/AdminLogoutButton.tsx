'use client'

import { adminPageHref } from '@/lib/admin-public-base'

type AdminLogoutButtonProps = {
  className?: string
  loginHref?: string
  /** Ha az operátor kijelentkezése után owner session megmarad, ide irányítunk. */
  dashboardHref?: string
}

export function AdminLogoutButton({
  className,
  loginHref,
  dashboardHref,
}: AdminLogoutButtonProps) {
  async function handleLogout() {
    try {
      // scope=active: operátor kijelentkezése nem törli a párhuzamos owner sessiont
      const res = await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'active' }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.cleared === 'operator' && data.preservedOwner && dashboardHref) {
        // Owner session megmaradt — visszatérés a főadmin felületre
        window.location.href = dashboardHref
        return
      }
    } catch {
      // A sütit a szerver törli; hálózati hiba esetén is a loginra irányítunk.
    }
    window.location.href = loginHref || adminPageHref('/admin/login')
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      Kijelentkezés
    </button>
  )
}
