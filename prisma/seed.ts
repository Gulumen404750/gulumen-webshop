/**
 * Prisma seed belépési pont – SZÁNDÉKOSAN biztonságos / üres.
 *
 * Éles Railway deploy NEM hívja ezt (nincs package.json "prisma.seed",
 * és scripts/start.js sem futtat seedet).
 *
 * Ha valaki mégis `npx prisma db seed`-et futtatna:
 * - NINCS deleteMany / archive
 * - Csak akkor megy tovább, ha ALLOW_PRODUCT_SEED=1
 * - A tényleges logika a create-only / empty-field-fill seed-products.ts
 */
import { spawnSync } from 'child_process'

if (process.env.ALLOW_PRODUCT_SEED !== '1') {
  console.error(
    '[prisma/seed] Megtagadva. Deploy/start nem seedelhet.\n' +
      'Manuális: ALLOW_PRODUCT_SEED=1 npx tsx scripts/seed-products.ts'
  )
  process.exit(1)
}

console.log('[prisma/seed] Delegating to scripts/seed-products.ts (no deleteMany)...')
const r = spawnSync('npx', ['tsx', 'scripts/seed-products.ts'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})
process.exit(r.status ?? 1)
