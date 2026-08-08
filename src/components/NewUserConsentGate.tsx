'use client'

// railway-deploy-trigger: welcome checkout coupon

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { RegistrationConsentModal } from '@/components/RegistrationConsentModal'
import {
  clearGoogleAuthPending,
  readGoogleAuthPending,
} from '@/lib/google-auth-pending'
import {
  hasRegistrationConsent,
  markRegistrationConsent,
} from '@/lib/registration-consent'

/**
 * Google első belépésnél (új fiók): kötelező ÁSZF modal, ha még nem fogadták el.
 * Meglévő fióknál soha nem jelenik meg.
 */
export function NewUserConsentGate() {
  const { userId, isNewUser, authChecked } = useAuth()
  const { claimRegistrationCoupon } = useCatCoupon()
  const [needsConsent, setNeedsConsent] = useState(false)

  useEffect(() => {
    if (!authChecked || !userId) {
      setNeedsConsent(false)
      return
    }

    // Csak vadonatúj Google fióknál
    if (!isNewUser) {
      setNeedsConsent(false)
      return
    }

    if (hasRegistrationConsent(userId)) {
      setNeedsConsent(false)
      return
    }

    const pending = readGoogleAuthPending()
    // Regisztrációs oldalról indított Google: privacy már elfogadva
    if (pending?.acceptPrivacy) {
      markRegistrationConsent(userId, pending.acceptOffers)
      if (pending.acceptOffers) {
        claimRegistrationCoupon(userId)
      }
      clearGoogleAuthPending()
      setNeedsConsent(false)
      return
    }

    setNeedsConsent(true)
  }, [authChecked, userId, isNewUser, claimRegistrationCoupon])

  const handleConfirm = ({ acceptOffers }: { acceptPrivacy: true; acceptOffers: boolean }) => {
    if (!userId) return
    markRegistrationConsent(userId, acceptOffers)
    if (acceptOffers) {
      claimRegistrationCoupon(userId)
    }
    clearGoogleAuthPending()
    setNeedsConsent(false)
  }

  return <RegistrationConsentModal open={needsConsent} onConfirm={handleConfirm} />
}
