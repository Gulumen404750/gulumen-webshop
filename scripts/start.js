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

run('npx', ['prisma', 'generate'])
run('npx', ['prisma', 'migrate', 'deploy'])

const port = process.env.PORT || '3000'
const result = spawnSync('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
