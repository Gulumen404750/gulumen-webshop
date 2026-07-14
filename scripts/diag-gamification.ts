/**
 * Gamification diagnosztika – futtatás: npx tsx scripts/diag-gamification.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const hasDb = Boolean(process.env.DATABASE_URL?.trim())
  console.log('\n=== Gamification diagnosztika ===\n')
  console.log('DATABASE_URL beállítva:', hasDb ? 'IGEN' : 'NEM (pontok nem működnek!)')

  if (!hasDb) {
    console.log('\n⚠️  DB nélkül a like-ok fájlban mentődnek, de pontok NEM jönnek.')
    console.log('   Állítsd be a DATABASE_URL-t a .env.local-ban, futtasd: npx prisma migrate deploy && npm run seed:products')
    return
  }

  const { prisma } = await import('../src/lib/prisma')
  const { processPendingPointEvents } = await import('../src/lib/gamification/point-event-queue')

  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('DB kapcsolat: OK')
  } catch (e) {
    console.log('DB kapcsolat: HIBA', e instanceof Error ? e.message : e)
    return
  }

  const [pending, processing, failed, completed, wallets, activities, windows, users, products] =
    await Promise.all([
      prisma.pointEvent.count({ where: { status: 'pending' } }),
      prisma.pointEvent.count({ where: { status: 'processing' } }),
      prisma.pointEvent.count({ where: { status: 'failed' } }),
      prisma.pointEvent.count({ where: { status: 'completed' } }),
      prisma.userPointWallet.findMany({ take: 10, orderBy: { updatedAt: 'desc' } }),
      prisma.userDailyActivity.findMany({ take: 5, orderBy: { updatedAt: 'desc' } }),
      prisma.userLikePointWindow.findMany({ take: 5, orderBy: { updatedAt: 'desc' } }),
      prisma.user.count(),
      prisma.product.count({ where: { type: 'stock', active: true } }),
    ])

  console.log('\nPointEvent státuszok:')
  console.log(`  pending: ${pending}, processing: ${processing}, failed: ${failed}, completed: ${completed}`)

  if (pending > 0) {
    const sample = await prisma.pointEvent.findMany({
      where: { status: 'pending' },
      take: 5,
      orderBy: { createdAt: 'asc' },
    })
    console.log('\n  Első pending események:')
    for (const e of sample) {
      console.log(`    - ${e.type} user=${e.userId.slice(0, 8)}… attempts=${e.attempts} key=${e.idempotencyKey}`)
    }
  }

  console.log(`\nUser-ek: ${users}, aktív stock termékek: ${products}`)
  console.log('\nWallet-ek (legutóbbi 10):')
  if (wallets.length === 0) {
    console.log('  (nincs wallet rekord)')
  } else {
    for (const w of wallets) {
      console.log(`  user=${w.userId.slice(0, 8)}… balance=${w.balance} earned=${w.lifetimeEarned}`)
    }
  }

  console.log('\nUserDailyActivity (legutóbbi 5):')
  for (const a of activities) {
    console.log(
      `  user=${a.userId.slice(0, 8)}… session=${a.sessionProgressSeconds}s bonusCount=${a.bonusGrantedCount} active=${a.activeSeconds}s`
    )
  }

  console.log('\nUserLikePointWindow (legutóbbi 5):')
  for (const w of windows) {
    console.log(
      `  user=${w.userId.slice(0, 8)}… likes=${w.qualifyingLikeCount} bonusGranted=${w.bonusGranted}`
    )
  }

  if (pending > 0) {
    console.log('\n→ Feldolgozás indítása (processPendingPointEvents)...')
    const processed = await processPendingPointEvents(50)
    console.log(`  Feldolgozva: ${processed} esemény`)

    const stillPending = await prisma.pointEvent.count({ where: { status: 'pending' } })
    console.log(`  Maradt pending: ${stillPending}`)

    const walletsAfter = await prisma.userPointWallet.findMany({ take: 5, orderBy: { updatedAt: 'desc' } })
    console.log('\nWallet-ek feldolgozás után:')
    for (const w of walletsAfter) {
      console.log(`  user=${w.userId.slice(0, 8)}… balance=${w.balance}`)
    }
  }

  console.log('\n=== Kész ===\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    const { prisma } = await import('../src/lib/prisma')
    await prisma.$disconnect()
  })
