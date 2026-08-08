/**
 * Production start (Railway):
 * - prisma generate + migrate deploy (adatvesztés nélküli séma-frissítés)
 * - NEM fut seed, NEM fut migrate reset / db push --force-reset
 * - NEM töröl / archivál termékeket
 */
console.log('[start] gulumen-webshop bootstrap v7 (no-seed, migrate deploy only)')
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

// Védelem: véletlenül se lehessen reset/seed env-ből elindítani deploykor
if (process.env.ALLOW_PRODUCT_SEED === '1') {
  console.warn(
    '[start] FIGYELEM: ALLOW_PRODUCT_SEED=1 be van állítva a környezetben, ' +
      'de a start script MÉGSE futtat seedet. Seed csak manuálisan: npm run seed:products'
  )
}

run('npx', ['prisma', 'generate'])

// Csak biztonságos production migráció – soha ne: migrate reset / db push --force-reset
console.log('[start] prisma migrate deploy (no reset, no data wipe)...')
run('npx', ['prisma', 'migrate', 'deploy'])

// Seed szándékosan NINCS meghívva.
// Korábban a seed archiválta a nem-katalógus (admin) termékeket – ez okozta a „deploy után eltűnnek” hibát.
console.log('[start] Product seed SKIPPED (manual only: ALLOW_PRODUCT_SEED=1 npm run seed:products)')
console.log('[start] No prisma db seed / migrate reset / force-reset on deploy.')

const port = process.env.PORT || '3000'
const hostname = process.env.HOSTNAME || '0.0.0.0'
console.log(`[start] Listening on ${hostname}:${port} (Railway PORT=${process.env.PORT ?? 'not set, default 3000'})`)
console.log(`[start] next start -H ${hostname} -p ${port}`)

const result = spawnSync('npx', ['next', 'start', '-H', hostname, '-p', port], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
