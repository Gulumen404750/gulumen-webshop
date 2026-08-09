/**
 * @deprecated Legacy Stripe checkout – NINCS atomi stock decrement / sourcing reservation.
 * Minden fizetés: POST /api/checkout (StripeProvider).
 *
 * Ez a végpont szándékosan 410 Gone – ne használd.
 */
import { NextResponse } from 'next/server'

const GONE_BODY = {
  error: 'Gone',
  code: 'legacy_stripe_checkout_removed',
  message:
    'This endpoint is deprecated. Use POST /api/checkout with an Idempotency-Key header instead.',
  use: '/api/checkout',
} as const

function goneResponse() {
  return NextResponse.json(GONE_BODY, {
    status: 410,
    headers: {
      Deprecation: 'true',
      Link: '</api/checkout>; rel="successor-version"',
    },
  })
}

export async function GET() {
  return goneResponse()
}

export async function POST() {
  return goneResponse()
}
