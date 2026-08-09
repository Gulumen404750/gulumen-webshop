/**
 * Production start: Next.js a Railway által adott PORT-on (vagy 3000 lokálisan).
 * Deploy előtt: Prisma client generálás + migrate deploy (táblák létrehozása/frissítése).
 * Így mind Linux (Railway) mind Windows (lokál) esetén helyesen indul.
 */
const { spawnSync } = require('child_process')

function run(name, args) {
  const r = spawnSync(name, args, { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

/** Fail-fast: production-ben kötelező JWT_SECRET (nincs hardkódolt fallback). */
function assertAuthEnv() {
  if (process.env.NODE_ENV !== 'production') return
  const min = 16
  const jwt = process.env.JWT_SECRET?.trim()
  if (!jwt || jwt.length < min) {
    console.error(
      '[start] FATAL: Missing or weak JWT_SECRET in production (min 16 chars). ' +
        'Set it via environment variables — no hardcoded fallback is allowed.'
    )
    process.exit(1)
  }
  const nextAuth = process.env.NEXTAUTH_SECRET?.trim()
  if (!nextAuth || nextAuth.length < min) {
    process.env.NEXTAUTH_SECRET = jwt
    console.warn(
      '[start] NEXTAUTH_SECRET missing — using JWT_SECRET as NEXTAUTH_SECRET.'
    )
  }
}

assertAuthEnv()

run('npx', ['prisma', 'generate'])
run('npx', ['prisma', 'migrate', 'deploy'])

const port = process.env.PORT || '3000'
const result = spawnSync('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
