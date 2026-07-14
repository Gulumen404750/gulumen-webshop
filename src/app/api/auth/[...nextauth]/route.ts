import '@/lib/bootstrap-auth-env'
import NextAuth from 'next-auth'
import { bootstrapAuthEnv } from '@/lib/bootstrap-auth-env'
import { getAuthOptions } from '@/lib/auth-options'

/** Never statically prerender – auth must read runtime Railway env. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Runtime handler – bootstrap + fresh options every request (NO_SECRET safe). */
function authHandler(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  bootstrapAuthEnv()
  const options = getAuthOptions()
  return NextAuth(options)(req, ctx)
}

export { authHandler as GET, authHandler as POST }
