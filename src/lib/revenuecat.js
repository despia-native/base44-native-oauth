// RevenueCat via Despia — native App Store / Google Play billing.
// Native: schemes bridged by the Despia runtime. Web: RevenueCat Web Purchase Link.
// Requires RevenueCat to be enabled in Despia (App > Settings > Integrations) + a rebuild.
import despia from 'despia-native'
import { appConfig } from '@/config/app-config'

const ua = navigator.userAgent.toLowerCase()
export const isDespia = ua.includes('despia')

// Query the native store for active entitlement ids. Instant + offline-capable.
// Only reflects native purchases — web purchases won't show up here.
export async function checkEntitlements() {
  if (!isDespia) return []
  const data = await despia('getpurchasehistory://', ['restoredData'])
  return (data?.restoredData ?? []).filter((p) => p.isActive).map((p) => p.entitlementId)
}

// Open the native RevenueCat paywall (configured in the RevenueCat dashboard).
// On web, fall back to the RevenueCat Web Purchase Link with the user id appended.
export function launchPaywall(userId) {
  const { offering, webPurchaseUrl } = appConfig.revenuecat
  if (isDespia) {
    despia(`revenuecat://launchPaywall?external_id=${encodeURIComponent(userId)}&offering=${offering}`)
  } else {
    window.location.href = `${webPurchaseUrl}/${encodeURIComponent(userId)}`
  }
}

// Native Customer Center — restore purchases, manage subscription, refunds (iOS).
export function openCustomerCenter(userId) {
  if (isDespia) despia(`revenuecat://center?external_id=${encodeURIComponent(userId)}`)
}