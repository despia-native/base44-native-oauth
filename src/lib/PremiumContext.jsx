// App-wide premium entitlement state, kept in sync with the native store.
// Checks on load, after every purchase (onRevenueCatPurchase), and after any
// Customer Center action that could change state (restore, refund, dismiss).
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { checkEntitlements } from '@/lib/revenuecat'
import { appConfig } from '@/config/app-config'

const PremiumContext = createContext({ isPremium: false, refreshEntitlements: async () => {} })

export function PremiumProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false)

  const refreshEntitlements = useCallback(async () => {
    const active = await checkEntitlements()
    setIsPremium(active.includes(appConfig.revenuecat.entitlementId))
  }, [])

  useEffect(() => {
    refreshEntitlements()

    // Fired by the Despia runtime when the store confirms a transaction.
    window.onRevenueCatPurchase = refreshEntitlements

    // Customer Center events — re-query the store (source of truth) on anything
    // state-changing; 'dismissed' is the catch-all safety net on close.
    window.onRevenueCatCenter = (event) => {
      const type = event?.event
      if (type === 'restoreCompleted' || type === 'refundCompleted' || type === 'dismissed') {
        refreshEntitlements()
      }
      if (type === 'managementOptionSelected' && event.option === 'customUrl') {
        window.location.href = event.uri
      }
    }

    return () => {
      window.onRevenueCatPurchase = null
      window.onRevenueCatCenter = null
    }
  }, [refreshEntitlements])

  return (
    <PremiumContext.Provider value={{ isPremium, refreshEntitlements }}>
      {children}
    </PremiumContext.Provider>
  )
}

export const usePremium = () => useContext(PremiumContext)