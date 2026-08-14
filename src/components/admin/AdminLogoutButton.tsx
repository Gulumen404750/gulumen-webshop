'use client'

type AdminLogoutButtonProps = {
  className?: string
}

export function AdminLogoutButton({ className }: AdminLogoutButtonProps) {
  async function handleLogout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // A sütit a szerver törli; hálózati hiba esetén is a loginra irányítunk.
    }
    window.location.href = '/admin/login'
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      Kijelentkezés
    </button>
  )
}
