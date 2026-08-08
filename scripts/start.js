/**
 * Production start: Next.js a Railway által adott PORT-on (vagy 3000 lokálisan).
 */
console.log('[start] gulumen-webshop bootstrap v6')
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

// Seed NEM fut automatikusan – manuális termékek védelme (Railway restart ne írja felül a képeket).
// Manuális futtatás: ALLOW_PRODUCT_SEED=1 npm run seed:products
console.log('[start] Product seed skipped (manual only: ALLOW_PRODUCT_SEED=1 npm run seed:products)')

// Railway: PORT env (gyakran 8080) + 0.0.0.0 – különben a proxy nem éri el a konténert
const port = process.env.PORT || '3000'
const hostname = process.env.HOSTNAME || '0.0.0.0'
console.log(`[start] Listening on ${hostname}:${port} (Railway PORT=${process.env.PORT ?? 'not set, default 3000'})`)
console.log(`[start] next start -H ${hostname} -p ${port}`)

const result = spawnSync('npx', ['next', 'start', '-H', hostname, '-p', port], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
