'use client'

import { adminPageHref } from '@/lib/admin-public-base'

type AdminLogoutButtonProps = {
  className?: string
  loginHref?: string
}

export function AdminLogoutButton({ className, loginHref }: AdminLogoutButtonProps) {
  async function handleLogout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
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
