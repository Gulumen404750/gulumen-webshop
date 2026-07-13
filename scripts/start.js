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

const port = process.env.PORT || '3000'
const result = spawnSync('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
