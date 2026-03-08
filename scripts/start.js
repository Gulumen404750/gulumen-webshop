/**
 * Production start: Next.js a Railway által adott PORT-on (vagy 3000 lokálisan).
 * Így mind Linux (Railway) mind Windows (lokál) esetén helyesen indul.
 */
const { spawnSync } = require('child_process')
const port = process.env.PORT || '3000'
const result = spawnSync('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
