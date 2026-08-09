import { describe, expect, it } from 'vitest'
import { withDeductedBalance, type PointWalletData } from './point-wallet-client'

function wallet(balance: number): PointWalletData {
  return {
    balance,
    lifetimeEarned: 1000,
    lifetimeRedeemed: 0,
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

  it('never goes below zero', () => {
    const next = withDeductedBalance(wallet(50), 200)
    expect(next.balance).toBe(0)
  })
})
