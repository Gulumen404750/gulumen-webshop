import { cookies } from 'next/headers'

/** Admin cookie ellenőrzése (admin_authorized=1). API route-okban használd. */
export async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('admin_authorized')?.value === '1'
}

export function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY
}
