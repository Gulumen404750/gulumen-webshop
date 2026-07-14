import { NextResponse } from 'next/server'
import {
  bootstrapAuthEnv,
  isGoogleAuthConfigured,
  readEnv,
  resolveNextAuthUrl,
  resolvePublicAppUrl,
} from '@/lib/bootstrap-auth-env'
import { checkDbConnectivity, isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/auth/debug
 * Nem érzékeny auth diagnosztika – Railway / éles OAuth hibakereséshez.
 * Ideiglenesen használd, majd távolítsd el vagy kapcsold ADMIN kulccsal.
 */
export async function GET() {
  bootstrapAuthEnv()
  const nextAuthUrl = resolveNextAuthUrl()
  const dbConfigured = isDbConfigured()
  const dbReachable = dbConfigured ? await checkDbConnectivity() : false

  return NextResponse.json({
    nextPublicAppUrl: resolvePublicAppUrl(),
    nextAuthUrl,
    expectedGoogleCallback: `${nextAuthUrl}/api/auth/callback/google`,
    googleOAuthConfigured: isGoogleAuthConfigured(),
    databaseUrlSet: dbConfigured,
    databaseReachable: dbReachable,
    nodeEnv: readEnv('NODE_ENV') ?? null,
    railway: Boolean(readEnv('RAILWAY_ENVIRONMENT')),
    authDebugEnabled: readEnv('AUTH_DEBUG') === 'true' || readEnv('AUTH_DEBUG') === '1',
    hint:
      'Google Console → Authorized redirect URI must match expectedGoogleCallback exactly. ' +
      'Set AUTH_DEBUG=true in Railway Variables for verbose NextAuth logs in HTTP Logs.',
  })
}
