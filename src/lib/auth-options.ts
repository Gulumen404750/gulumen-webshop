/**
 * NextAuth options: Google OAuth + JWT session.
 * getAuthOptions() builds at request time so Railway runtime env is always used.
 */
import '@/lib/bootstrap-auth-env'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  bootstrapAuthEnv,
  readEnv,
  resolveNextAuthSecret,
} from '@/lib/bootstrap-auth-env'

function buildAuthOptions(): NextAuthOptions {
  bootstrapAuthEnv()

  // resolveNextAuthSecret() uses dynamic env reads – not build-inlined by Next.js.
  const secret = resolveNextAuthSecret()
  process.env.NEXTAUTH_SECRET = secret

  return {
    providers: [
      GoogleProvider({
        clientId: readEnv('GOOGLE_CLIENT_ID') ?? '',
        clientSecret: readEnv('GOOGLE_CLIENT_SECRET') ?? '',
        authorization: {
          params: {
            // Mindig fiókválasztó + szükség esetén hozzájárulás (ne automatikusan az aktív böngésző-fiók).
            prompt: 'select_account',
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
        let isNewUser = false
        if (!dbUser) {
          isNewUser = true
          dbUser = await prisma.user.create({
            data: {
              email: emailNorm,
              name: user.name ?? null,
              passwordHash: null,
            },
          })
        }
        const authUser = user as { id?: string; isNewUser?: boolean }
        authUser.id = dbUser.id
        authUser.isNewUser = isNewUser
        return true
      },
      async jwt({ token, user }) {
        if (user?.email) {
          token.email = user.email
          token.userId = (user as { id?: string }).id
          if ((user as { isNewUser?: boolean }).isNewUser) {
            token.isNewUser = true
          }
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
    secret,
  }
}

export function getAuthOptions(): NextAuthOptions {
  return buildAuthOptions()
}
