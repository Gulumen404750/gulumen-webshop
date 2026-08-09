/**
 * Dev gamification smoke test – DB nélkül (gyors: csak like bónusz).
 * Futtatás: npx tsx scripts/test-dev-gamification.ts
 */
import { devGetWallet, devOnLikeToggle } from '../src/lib/dev-gamification'

const userId = 'test-user-smoke'

async function main() {
  console.log('\n=== Dev gamification smoke test (likes) ===\n')

  for (let i = 1; i <= 10; i++) {
    const r = devOnLikeToggle(userId, `3d-${i}`, true)
    console.log(`Like ${i}: count=${r.qualifyingLikeCount} bonus=${r.dailyBonusQueued}`)
  }

  const wallet = devGetWallet(userId)
  console.log(`\nWallet: ${wallet.balance} pont (várható: 25)`)

  if (wallet.balance === 25) {
    console.log('✅ Like bónusz OK\n')
  } else {
    console.log('❌ Eltérés\n')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
