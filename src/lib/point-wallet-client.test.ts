import { describe, expect, it } from 'vitest'
import { withDeductedBalance, type PointWalletData } from './point-wallet-client'

function wallet(balance: number): PointWalletData {
  return {
    balance,
    lifetimeEarned: 1000,
    lifetimeRedeemed: 0,
    lifetimeSavedHuf: 0,
    redeemThreshold: 350,
    canRedeem: balance >= 350,
    hasActiveCoupon: false,
    activeCouponCode: null,
    suspended: false,
  }
}

describe('withDeductedBalance', () => {
  it('deducts points and updates canRedeem', () => {
    const next = withDeductedBalance(wallet(500), 200)
    expect(next.balance).toBe(300)
    expect(next.lifetimeRedeemed).toBe(200)
    expect(next.canRedeem).toBe(false)
  })

  it('still allows another coupon redeem when one is already unused', () => {
    const next = withDeductedBalance(
      {
        ...wallet(753),
        hasActiveCoupon: true,
        activeCouponCode: 'GLM-EXISTING',
      },
      50
    )
    expect(next.balance).toBe(703)
    expect(next.canRedeem).toBe(true)
    expect(next.redeemableCount).toBe(2)
  })
})
