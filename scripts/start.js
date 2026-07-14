/**
 * Production start: Next.js a Railway által adott PORT-on (vagy 3000 lokálisan).
 * Deploy előtt: Prisma client generálás + migrate deploy (táblák létrehozása/frissítése).
 * Így mind Linux (Railway) mind Windows (lokál) esetén helyesen indul.
 */
require('./load-env.cjs')
require('./bootstrap-auth-env.cjs')

const { spawnSync } = require('child_process')

function run(name, args) {
  const r = spawnSync(name, args, { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error('')
  console.error('[start] HIBA: DATABASE_URL nincs beállítva.')
  console.error('[start] Railway → gulumen-webshop (NEM dynamic-perfection) → Variables →')
  console.error('[start]   New Variable → DATABASE_URL → Reference → Postgres → DATABASE_URL')
  console.error('')
  process.exit(1)
}

run('npx', ['prisma', 'generate'])
run('npx', ['prisma', 'migrate', 'deploy'])

console.log('[start] Seeding canonical storefront catalog...')
const seed = spawnSync('npx', ['tsx', 'scripts/seed-products.ts'], { stdio: 'inherit', shell: true })
if (seed.status !== 0) {
  console.warn('[start] Product seed failed (non-fatal) – storefront may show stale DB data')
}

// Railway: PORT env + 0.0.0.0 (különben a proxy nem éri el a konténert)
const port = process.env.PORT || '3000'
const hostname = process.env.HOSTNAME || '0.0.0.0'
console.log(`[start] next start -H ${hostname} -p ${port}`)

const result = spawnSync('npx', ['next', 'start', '-H', hostname, '-p', port], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
