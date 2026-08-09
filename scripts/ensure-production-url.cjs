/**
 * Railway: NEXT_PUBLIC_APP_URL gyakran localhost marad production Variables-ben.
 * next build beégeti a NEXT_PUBLIC_* értékeket – build előtt javítjuk.
 * Start előtt is fut (scripts/start.js).
 */
const PRODUCTION_APP_URL = 'https://www.gulumen.com'

function readEnv(key) {
  return (process.env[key] || '').trim() || undefined
}

function isLocalhostUrl(url) {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url)
  }
}

function isProductionContext() {
  return (
    readEnv('NODE_ENV') === 'production' ||
    Boolean(readEnv('RAILWAY_ENVIRONMENT')) ||
    Boolean(readEnv('RAILWAY_PROJECT_ID')) ||
    Boolean(readEnv('DATABASE_URL')?.includes('railway.internal'))
  )
}

function ensureProductionUrls(phase) {
  if (!isProductionContext()) return

  let fixed = false
  const appUrl = readEnv('NEXT_PUBLIC_APP_URL')
  if (!appUrl || isLocalhostUrl(appUrl)) {
    console.warn(
      `[${phase}] NEXT_PUBLIC_APP_URL was "${appUrl || 'missing'}" – using ${PRODUCTION_APP_URL}`
    )
    process.env.NEXT_PUBLIC_APP_URL = PRODUCTION_APP_URL
    fixed = true
  }

  const nextAuthUrl = readEnv('NEXTAUTH_URL')
  if (!nextAuthUrl || isLocalhostUrl(nextAuthUrl)) {
    process.env.NEXTAUTH_URL = readEnv('NEXT_PUBLIC_APP_URL') || PRODUCTION_APP_URL
    console.warn(`[${phase}] NEXTAUTH_URL set to ${process.env.NEXTAUTH_URL}`)
    fixed = true
  }

  if (fixed) {
    console.warn(
      `[${phase}] Fix Railway Variables: NEXT_PUBLIC_APP_URL and NEXTAUTH_URL → ${PRODUCTION_APP_URL}`
    )
  }
}

module.exports = { ensureProductionUrls, PRODUCTION_APP_URL }
