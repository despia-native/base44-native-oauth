// Notification tap payloads (Despia → window.onNotificationEvent).
// The host app calls window.onNotificationEvent on every notification tap,
// after applying the URL change. We keep the last payload and broadcast it so
// any screen (e.g. the /demo page) can display path/url/metadata round-trips.
// Registered at the very top of the entry bundle (see main.jsx) so payloads
// buffered from cold starts are never missed.

const EVENT = 'push-notification-open'
let lastPayload = null

window.onNotificationEvent = (payload) => {
  // Dashboard sends metadata as a string; REST API sends a real object.
  if (payload && typeof payload.metadata === 'string') {
    try { payload = { ...payload, metadata: JSON.parse(payload.metadata) } } catch { /* keep as string */ }
  }
  lastPayload = { ...payload, receivedAt: new Date().toISOString() }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: lastPayload }))
}

// Last tap payload received this session (null if none yet).
export function getLastNotificationEvent() {
  return lastPayload
}

// Subscribe to tap payloads; returns an unsubscribe function.
export function onNotificationOpen(handler) {
  const listener = (e) => handler(e.detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}