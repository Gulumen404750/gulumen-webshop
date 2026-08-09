/**
 * Auth: JWT cookie session (email/jelszó) + NextAuth JWT (Google OAuth).
 * getToken() dinamikus secret-tel – elkerüli a Railway NO_SECRET build/runtime problémákat.
 */
import { SignJWT, jwtVerify } from 'jose'
import { decode } from 'next-auth/jwt'
import { resolveJwtSecret, resolveNextAuthSecret } from '@/lib/bootstrap-auth-env'

const COOKIE_NAME = 'gulumen-session'
const JWT_ISSUER = 'gulumen'
const JWT_AUDIENCE = 'gulumen-app'
const MAX_AGE_SEC = 30 * 24 * 60 * 60 // 30 nap

export type SessionUser = {
  userId: string
  email: string
  provider?: 'credentials' | 'google'
  isNewUser?: boolean
}

function getSecret(): Uint8Array | null {
  const secret = resolveJwtSecret()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
}

/** True ha JWT titok be van állítva (legalább 16 karakter). */
export function isJwtConfigured(): boolean {
  return getSecret() !== null
}

async function getCredentialsSession(request: Request): Promise<SessionUser | null> {
  const secret = getSecret()
  if (!secret) return null
  const cookie = request.headers.get('cookie')
  if (!cookie) return null
  const match = cookie.match(new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]+)`))
  const token = match?.[1]
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    const sub = payload.sub
    const email = payload.email as string | undefined
    if (!sub || !email) return null
    return { userId: sub, email: email.trim().toLowerCase(), provider: 'credentials' }
  } catch {
    return null
  }
}

function getNextAuthSessionToken(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined
  const cookieNames = ['__Secure-next-auth.session-token', 'next-auth.session-token']
  for (const name of cookieNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${escaped}=([^;]+)`))
    if (match?.[1]) return decodeURIComponent(match[1])
  }
  return undefined
}

async function getGoogleSession(request: Request): Promise<SessionUser | null> {
  const secret = resolveNextAuthSecret()
  if (!secret) return null
  const sessionToken = getNextAuthSessionToken(request.headers.get('cookie'))
  if (!sessionToken) return null
  try {
    const token = await decode({ token: sessionToken, secret })
    if (!token?.email) return null
    const email = String(token.email).trim().toLowerCase()
    const userId = (token.userId as string | undefined) || (token.sub as string | undefined) || email
    return {
      userId,
      email,
      provider: 'google',
      isNewUser: token.isNewUser === true,
    }
  } catch {
    return null
  }
}

export async function getSession(request: Request): Promise<SessionUser | null> {
  const credentials = await getCredentialsSession(request)
  if (credentials) return credentials
  return getGoogleSession(request)
}

/** Prisma User.id – kedvelésekhez és wishlisthez (email/jelszó és Google OAuth). */
export async function resolveSessionUserId(session: SessionUser): Promise<string | null> {
  const email = session.email?.trim().toLowerCase()
  if (!email) return null
  const { isDbConfigured, prisma } = await import('@/lib/prisma')
  if (isDbConfigured()) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    return user?.id ?? null
  }
  const { devFindUserByEmail, devFindUserById } = await import('@/lib/dev-auth')
  const byEmail = devFindUserByEmail(email)
  if (byEmail) return byEmail.id
  const byId = devFindUserById(session.userId)
  return byId?.id ?? session.userId
}

export async function createSession(userId: string, email: string): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET not configured')
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + MAX_AGE_SEC)
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .sign(secret)
  return token
}

export function getSessionCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === 'production'
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + MAX_AGE_SEC,
    ...(isProd ? ['Secure'] : []),
  ].join('; ')
}

export function getClearSessionCookieHeader(): string {
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ')
}

export { COOKIE_NAME }
