/**
 * NextAuth options: Google OAuth + JWT session.
 * getAuthOptions() – runtime-on épül, hogy a Railway env (DATABASE_URL stb.) biztosan elérhető legyen.
 */
import '@/lib/bootstrap-auth-env'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { bootstrapAuthEnv, BUILTIN_NEXTAUTH_SECRET } from '@/lib/bootstrap-auth-env'

function buildAuthOptions(): NextAuthOptions {
  bootstrapAuthEnv()
  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        authorization: {
          params: {
            prompt: 'consent',
            access_type: 'offline',
            response_type: 'code',
          },
        },
      }),
    ],
    session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider !== 'google' || !user?.email) return false
        if (!isDbConfigured()) return false
        const emailNorm = user.email.trim().toLowerCase()
        let dbUser = await prisma.user.findUnique({ where: { email: emailNorm } })
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: emailNorm,
              name: user.name ?? null,
              passwordHash: null,
            },
          })
        }
        (user as { id?: string }).id = dbUser.id
        return true
      },
      async jwt({ token, user }) {
        if (user?.email) {
          token.email = user.email
          token.userId = (user as { id?: string }).id
        }
        return token
      },
      async session({ session, token }) {
        if (session.user) {
          (session.user as { id?: string }).id = token.userId as string
          session.user.email = (token.email as string) ?? ''
        }
        return session
      },
      async redirect({ url, baseUrl }) {
        if (url.startsWith('/')) return `${baseUrl}${url}`
        if (new URL(url).origin === baseUrl) return url
        return `${baseUrl}/profil`
      },
    },
    pages: {
      signIn: '/profil',
      error: '/profil',
    },
    // NextAuth assertConfig productionben csak options.secret-et nézi – mindig legyen érték
    secret: process.env['NEXTAUTH_SECRET'] || BUILTIN_NEXTAUTH_SECRET,
  }
}

let cachedAuthOptions: NextAuthOptions | null = null

export function getAuthOptions(): NextAuthOptions {
  cachedAuthOptions = buildAuthOptions()
  return cachedAuthOptions
}
