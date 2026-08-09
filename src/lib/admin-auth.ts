import { cookies } from 'next/headers'
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-session'

/** Admin aláírt session cookie ellenőrzése. API route-okban használd. */
export async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminSessionToken(token)
}

export function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY
}
