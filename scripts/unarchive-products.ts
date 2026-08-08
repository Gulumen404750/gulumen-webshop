/**
 * Egyszeri helyreállítás: a régi deploy-seed által tévesen archivált termékek visszaállítása.
 *
 * A korábbi seed a nem-katalógus slugokat `archived=true, active=false`-ra állította.
 * Ez a script visszaállítja azokat (nem töröl semmit).
 *
 * Futtatás (production):
 *   ALLOW_UNARCHIVE_PRODUCTS=1 npx tsx scripts/unarchive-products.ts
 *
 * Opcionális szűrés csak bizonyos slugokra:
 *   ALLOW_UNARCHIVE_PRODUCTS=1 UNARCHIVE_SLUGS=slug1,slug2 npx tsx scripts/unarchive-products.ts
 */

import { PrismaClient } from '@prisma/client'

if (process.env.ALLOW_UNARCHIVE_PRODUCTS !== '1') {
  console.error(
    'Megtagadva. Ha vissza akarod állítani az archivált termékeket:\n' +
      '  ALLOW_UNARCHIVE_PRODUCTS=1 npx tsx scripts/unarchive-products.ts'
  )
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  const slugEnv = process.env.UNARCHIVE_SLUGS?.trim()
  const slugs = slugEnv
    ? slugEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : null

  const where = {
    archived: true,
    ...(slugs ? { slug: { in: slugs } } : {}),
  }

  const victims = await prisma.product.findMany({
    where,
    select: { id: true, slug: true, name: true },
    take: 500,
  })

  if (victims.length === 0) {
    console.log('[unarchive] Nincs archivált termék a szűrés szerint.')
    return
  }

  console.log(`[unarchive] ${victims.length} termék visszaállítása:`)
  for (const p of victims) console.log(`  - ${p.slug} (${p.name})`)

  const result = await prisma.product.updateMany({
    where,
    data: { archived: false, active: true },
  })

  console.log(`[unarchive] Kész: ${result.count} termék active=true, archived=false.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
