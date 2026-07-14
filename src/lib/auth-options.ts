/**
 * NextAuth options: Google OAuth + JWT session.
 * getAuthOptions() builds at request time so Railway runtime env is always used.
 */
import '@/lib/bootstrap-auth-env'
import type { NextAuthOptions } from 'next-auth'
import type { Account, Profile, User } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  bootstrapAuthEnv,
  readEnv,
  resolveNextAuthSecret,
  resolveNextAuthUrl,
  isGoogleAuthConfigured,
  isProductionRuntime,
} from '@/lib/bootstrap-auth-env'
import { checkDbConnectivity } from '@/lib/prisma'

const AUTH_ERROR_BASE = '/profil'

/** Google Console redirect URI – mindig www, hostfüggetlenül. */
const GOOGLE_OAUTH_CANONICAL_ORIGIN = 'https://www.gulumen.com'
const GOOGLE_ISSUER = 'https://accounts.google.com'

function authErrorRedirect(code: string): string {
  return `${AUTH_ERROR_BASE}?authError=${encodeURIComponent(code)}`
}

function safeEmailHint(email: string | null | undefined): string | undefined {
  if (!email) return undefined
  const parts = email.split('@')
  if (parts.length !== 2) return '(invalid-format)'
  return `***@${parts[1]}`
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin)
  }
}

/** Élesben fix www origin – OAuth callback URI egyezés a Google Console-lal. */
function resolveGoogleOAuthBaseUrl(): string {
  const resolved = resolveNextAuthUrl()
  if (!isProductionRuntime() || isLocalhostOrigin(resolved)) return resolved
  return GOOGLE_OAUTH_CANONICAL_ORIGIN
}

function logSignInError(
  reason: string,
  ctx: { user: User; account: Account | null; profile?: Profile },
): void {
  console.error(`[auth] signIn error: ${reason}`, {
    user: ctx.user,
    account: ctx.account,
    profile: ctx.profile,
  })
}

function buildAuthOptions(): NextAuthOptions {
  bootstrapAuthEnv()

  const secret = resolveNextAuthSecret()
  const nextAuthUrl = resolveGoogleOAuthBaseUrl()
  process.env.NEXTAUTH_SECRET = secret
  process.env.NEXTAUTH_URL = nextAuthUrl

  const googleClientId = readEnv('GOOGLE_CLIENT_ID') ?? ''
  const googleClientSecret = readEnv('GOOGLE_CLIENT_SECRET') ?? ''
  const authDebug = readEnv('AUTH_DEBUG') === 'true' || readEnv('AUTH_DEBUG') === '1'
  const googleCallbackUrl = `${nextAuthUrl}/api/auth/callback/google`

  if (!isGoogleAuthConfigured()) {
    console.error('[auth] Google OAuth missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
  } else {
    console.log('[auth] Google OAuth issuer:', GOOGLE_ISSUER)
    console.log('[auth] Google OAuth callback:', googleCallbackUrl)
  }

  return {
    debug: authDebug,
    providers: [
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        issuer: GOOGLE_ISSUER,
        checks: ['pkce', 'state'],
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
    events: {
      async signIn(message) {
        console.log('[auth-event] signIn ok', {
          provider: message.account?.provider,
          userId: message.user?.id,
          email: safeEmailHint(message.user?.email),
          isNewUser: message.isNewUser,
        })
      },
    },
    callbacks: {
      async signIn({ user, account, profile }) {
        const ctx = { user, account: account ?? null, profile }

        console.error('[auth] signIn callback start', {
          provider: account?.provider,
          accountType: account?.type,
          hasEmail: Boolean(user?.email),
          emailHint: safeEmailHint(user?.email),
          hasAccount: Boolean(account),
          profileKeys: profile && typeof profile === 'object' ? Object.keys(profile) : [],
          isDbConfigured: isDbConfigured(),
          nextAuthUrl,
          googleCallbackUrl,
          googleConfigured: isGoogleAuthConfigured(),
        })

        if (account?.provider !== 'google' || !user?.email) {
          logSignInError('missing google provider or email', ctx)
          return authErrorRedirect('google_email_missing')
        }

        if (!isDbConfigured()) {
          logSignInError('DATABASE_URL not configured', ctx)
          return authErrorRedirect('db_not_configured')
        }

        const dbReachable = await checkDbConnectivity()
        if (!dbReachable) {
          logSignInError('Postgres not reachable', ctx)
          return authErrorRedirect('db_unreachable')
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
          console.error('[auth] signIn callback success', {
            userId: dbUser.id,
            isNewUser,
            emailHint: safeEmailHint(emailNorm),
          })
          const authUser = user as { id?: string; isNewUser?: boolean }
          authUser.id = dbUser.id
          authUser.isNewUser = isNewUser
          return true
        } catch (e) {
          logSignInError('user create/lookup failed', ctx)
          console.error('[auth] signIn user create/lookup exception', {
            error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : e,
            emailHint: safeEmailHint(emailNorm),
          })
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
        const canonicalBase = resolveGoogleOAuthBaseUrl()
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
