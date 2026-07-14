import { NextResponse } from 'next/server'
import {
  bootstrapAuthEnv,
  isGoogleAuthConfigured,
  readEnv,
  resolveNextAuthUrl,
} from '@/lib/bootstrap-auth-env'

function envStatus(key: string): 'OK' | 'HIÁNYZIK' {
  return readEnv(key) ? 'OK' : 'HIÁNYZIK'
}

/**
 * GET /api/auth/debug
 * Nem érzékeny auth diagnosztika – Railway / éles OAuth hibakereséshez.
 */
export async function GET() {
  bootstrapAuthEnv()
  const nextAuthUrl = resolveNextAuthUrl()

  return NextResponse.json({
    env: {
      GOOGLE_CLIENT_ID: envStatus('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: envStatus('GOOGLE_CLIENT_SECRET'),
      NEXTAUTH_SECRET: envStatus('NEXTAUTH_SECRET'),
      NEXTAUTH_URL: envStatus('NEXTAUTH_URL'),
      DATABASE_URL: envStatus('DATABASE_URL'),
      JWT_SECRET: envStatus('JWT_SECRET'),
      NEXT_PUBLIC_APP_URL: envStatus('NEXT_PUBLIC_APP_URL'),
    },
    nextAuthUrlDetected: nextAuthUrl,
    expectedGoogleCallback: `${nextAuthUrl}/api/auth/callback/google`,
    googleOAuthConfigured: isGoogleAuthConfigured(),
    authDebugEnabled: readEnv('AUTH_DEBUG') === 'true' || readEnv('AUTH_DEBUG') === '1',
    hint:
      'Google Console → Authorized redirect URI must match expectedGoogleCallback exactly. ' +
      'Set AUTH_DEBUG=true in Railway Variables for verbose NextAuth logs in HTTP Logs.',
  })
}
