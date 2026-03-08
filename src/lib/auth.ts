/**
 * Auth: NextAuth (Google) + httpOnly session cookie (JWT, email/jelszó).
 * getSession(request) – először NextAuth session, majd saját JWT.
 */
import { SignJWT, jwtVerify } from 'jose'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const COOKIE_NAME = 'gulumen-session'
const JWT_ISSUER = 'gulumen'
const JWT_AUDIENCE = 'gulumen-app'
const MAX_AGE_SEC = 30 * 24 * 60 * 60 // 30 nap

export type SessionUser = {
  userId: string
  email: string
}

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
}

/** True ha JWT_SECRET be van állítva (legalább 16 karakter). Auth 503 ellenőrzéshez. */
export function isJwtConfigured(): boolean {
  return getSecret() !== null
}

export async function getSession(request: Request): Promise<SessionUser | null> {
  const nextSession = await getServerSession(authOptions)
  if (nextSession?.user?.email) {
    const id = (nextSession.user as { id?: string }).id
    if (id) return { userId: id, email: nextSession.user.email }
  }
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
    return { userId: sub, email }
  } catch {
    return null
  }
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
