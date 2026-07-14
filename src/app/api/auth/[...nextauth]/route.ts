import '@/lib/bootstrap-auth-env'
import NextAuth from 'next-auth'
import { getAuthOptions } from '@/lib/auth-options'

/** Runtime handler – friss env + secret minden kérésnél (Railway NO_SECRET elkerülés). */
function authHandler(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  return NextAuth(getAuthOptions())(req, ctx)
}

export { authHandler as GET, authHandler as POST }
