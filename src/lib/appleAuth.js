// Sign In with Apple — platform-aware (Despia).
// iOS + web: Apple JS SDK popup → native Face ID sheet (iOS) / browser popup (web).
// Android: no native sheet exists — Chrome Custom Tabs via the oauth:// bridge,
// the id_token comes back through the deeplink and is handled on /auth.
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'
import { appConfig } from '@/config/app-config'

const ua = navigator.userAgent.toLowerCase()
const isDespia = ua.includes('despia')
const isDespiaAndroid = isDespia && ua.includes('android')

// Resolves to { idToken, fullName } on iOS/web, or null on Android
// (where sign-in continues via the deeplink → /auth flow).
export async function signInWithApple() {
  if (isDespiaAndroid) {
    const res = await base44.functions.invoke('appleAuthUrl', { deeplink_scheme: appConfig.deeplinkScheme })
    despia(`oauth://?url=${encodeURIComponent(res.data.url)}`)
    return null
  }

  if (!window.AppleID?.auth) throw new Error('Apple sign-in is unavailable')

  window.AppleID.auth.init({
    clientId: appConfig.appleServicesId,
    scope: 'name email',
    // Must exactly match the return URL registered for the Services ID.
    redirectURI: window.location.origin + '/',
    usePopup: true, // required — redirect mode blanks the screen and gets App Store rejections
  })

  const response = await window.AppleID.auth.signIn()
  // Apple only sends the user's name on the very first sign-in.
  const name = response.user?.name
  const fullName = name ? `${name.firstName || ''} ${name.lastName || ''}`.trim() : ''
  return { idToken: response.authorization.id_token, fullName }
}