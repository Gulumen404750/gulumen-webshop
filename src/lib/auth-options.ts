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
  resolveNextAuthUrl,
  isGoogleAuthConfigured,
} from '@/lib/bootstrap-auth-env'

const AUTH_ERROR_BASE = '/profil'

function authErrorRedirect(code: string): string {
  return `${AUTH_ERROR_BASE}?authError=${encodeURIComponent(code)}`
}

function buildAuthOptions(): NextAuthOptions {
  bootstrapAuthEnv()

  const secret = resolveNextAuthSecret()
  const nextAuthUrl = resolveNextAuthUrl()
  process.env.NEXTAUTH_SECRET = secret
  process.env.NEXTAUTH_URL = nextAuthUrl

  const googleClientId = readEnv('GOOGLE_CLIENT_ID') ?? ''
  const googleClientSecret = readEnv('GOOGLE_CLIENT_SECRET') ?? ''

  if (!isGoogleAuthConfigured()) {
    console.error('[auth] Google OAuth missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
  } else {
    console.log('[auth] Google OAuth callback:', `${nextAuthUrl}/api/auth/callback/google`)
  }

  return {
    providers: [
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        authorization: {
          params: {
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
        if (account?.provider !== 'google' || !user?.email) {
          return authErrorRedirect('google_email_missing')
        }

        if (!isDbConfigured()) {
          console.error('[auth] Google signIn blocked: DATABASE_URL not configured')
          return authErrorRedirect('db_not_configured')
        }

        const emailNorm = user.email.trim().toLowerCase()
        try {
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
        } catch (e) {
          console.error('[auth] Google signIn user create/lookup failed', e)
          return authErrorRedirect('user_create_failed')
        }
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
        const canonicalBase = resolveNextAuthUrl()
        const effectiveBase = canonicalBase || baseUrl
        if (url.startsWith('/')) return `${effectiveBase}${url}`
        try {
          if (new URL(url).origin === effectiveBase) return url
        } catch {
          /* ignore malformed url */
        }
        return `${effectiveBase}/profil`
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
