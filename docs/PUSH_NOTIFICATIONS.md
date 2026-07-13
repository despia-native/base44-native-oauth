# Push Notifications (OneSignal via Despia)

Native push to iOS/Android devices, targeted by our own **Account ids**. Despia bundles
the native OneSignal SDK at runtime; we never touch Player IDs — devices are linked to
users via `external_id` (our Account id). All sending goes through authenticated backend
functions; the OneSignal REST API key never reaches the client.

**Scope:** standard delivery, deep linking, scheduling, iOS badges, tag segments.
**Explicitly out of scope:** critical alerts (Do-Not-Disturb bypass) — they require a
manually-approved Apple entitlement and a Despia rebuild; this template does not use them.

---

## Architecture

```
App launch (native)     Despia auto-registers the device with OneSignal (no code)
Authenticated load      AuthContext → linkPushUser(account.id)
                        → despia('setonesignalplayerid://?user_id=<id>')
                        → OneSignal stores device ↔ external_id mapping
Send (any use case)     src/lib/push.js wrapper → sendPush backend function (JWT verified)
                        → POST onesignal.com/api/v1/notifications
                        → include_external_user_ids / included_segments / tag filters
Notification tap        data.path → Despia pushState + popstate → react-router navigates
                        data.metadata → window.onNotificationEvent (optional handler)
```

Key properties:

- **One send function** (`sendPush`) handles every target type. One tag function (`pushTags`).
- **external_id = Account id.** Whatever you pass to `linkPushUser` is what you target with.
- **Web preview**: all client helpers are no-ops / return `null` outside the Despia shell —
  the app never crashes in a browser.

## Files

| File | Purpose |
|---|---|
| `base44/functions/sendPush/entry.ts` | The one send function. Verifies our JWT, builds the OneSignal payload, enforces permissions. |
| `base44/functions/pushTags/entry.ts` | Sets OneSignal tags on a user (for tag-based segments). |
| `src/lib/push.js` | All client wrappers — linking, permissions, and every send variant. |
| `src/lib/AuthContext.jsx` | Calls `linkPushUser(account.id)` on every authenticated load. |
| `src/pages/AdminPush.jsx` (`/admin/push`) | Admin dashboard: broadcast or push to a looked-up user. |
| `src/pages/Debug.jsx` (`/debug`) | Permission status + "send myself a test push". |

## One-time setup (🔧 TEMPLATE)

1. OneSignal: create an app with **Native iOS** + **Native Android** platforms
   (Apple `.p8` push key + Firebase credentials — see setup.despia.com/native-features/onesignal).
2. Copy **App ID** and **REST API Key** from OneSignal → Settings → Keys & IDs.
3. Set the app secrets `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`
   (Base44 dashboard → Settings → Environment Variables).
4. Despia Editor → App → Settings → Integrations → OneSignal → toggle on, paste the **App ID**.
5. **Rebuild the app in Despia.** The SDK compiles into the binary — without a rebuild,
   linking calls resolve silently and API sends "succeed" but never deliver.

---

## Client API — `src/lib/push.js`

### Device linking & permissions

| Function | Returns | Notes |
|---|---|---|
| `linkPushUser(userId)` | void | Links this device to the user. Already called on every authenticated load by `AuthContext` — you never call it manually unless you build a new auth flow. No-op on web. |
| `checkPushPermission()` | `true` / `false` / `null` | `null` = web, or the native bridge didn't answer within 2s (anti-freeze). |
| `openDeviceSettings()` | void | Opens the OS settings page for the app so the user can enable notifications. |
| `isDespia` | boolean | `true` inside the native shell. |

Recommended pattern (used by `/debug`): check on load, show a non-blocking banner with an
"Open Settings" button when `false` — never block the user.

### Sending

All senders return the backend response (`{ success, id, recipients }`) and **throw** on
failure (axios error — message in `err.response.data.error`).

| Function | Who may call | Targets |
|---|---|---|
| `sendPushToSelf(opts)` | any logged-in user | the caller's own devices |
| `sendPushToUser(userId, opts)` | admin | one Account id |
| `sendPushToUsers(userIds, opts)` | admin | array of Account ids |
| `sendPushToAll(opts)` | admin | every subscribed device |
| `sendPushToTag(tag, opts)` | admin | tag segment, e.g. `{ key: 'plan', value: 'premium' }` (`relation` defaults `'='`; also `'>' '<' '!=' 'exists' 'not_exists'`) |
| `sendPush({ target, userId, ... })` | mixed | legacy generic form — prefer the named wrappers above |

### Shared `opts` (all senders)

| Option | Type | Required | Behavior |
|---|---|---|---|
| `title` | string | ✅ | Notification title |
| `message` | string | ✅ | Notification body |
| `path` | string | – | In-app route opened on tap, e.g. `/orders/123?tab=tracking`. Despia applies it via the History API + `popstate` — react-router navigates automatically, **no reload, no extra code**. |
| `url` | string | – | Full URL — forces a complete WebView reload on tap. Legacy; use only when a reload is genuinely needed. |
| `metadata` | any JSON | – | Arbitrary state delivered to `window.onNotificationEvent` on tap (see Routing below). |
| `sendAfter` | string | – | Schedule at an absolute UTC time, e.g. `'2026-01-01T09:00:00Z'`. |
| `deliveryTimeOfDay` | string | – | Deliver at each user's **local** time, e.g. `'9:00AM'` (sets OneSignal `delayed_option: 'timezone'`). |
| `badge` | object | – | iOS app-icon badge: `{ type: 'Increase' \| 'SetTo' \| 'None', count }`. `Increase` adds `count` to the current badge; `SetTo` sets it exactly; `None` leaves it. Defaults: `type 'Increase'`, `count 1`. |

Examples:

```js
import {
  sendPushToSelf, sendPushToUser, sendPushToUsers,
  sendPushToAll, sendPushToTag, setPushTags,
} from '@/lib/push'

// Simple
await sendPushToSelf({ title: 'Test', message: 'It works' })

// Deep link + badge
await sendPushToUser(accountId, {
  title: 'Order shipped',
  message: 'Tap to track it',
  path: '/orders/4567?tab=tracking',
  badge: { type: 'Increase', count: 1 },
})

// Broadcast at each user's local 9am
await sendPushToAll({ title: 'Good morning', message: 'Daily digest ready', deliveryTimeOfDay: '9:00AM' })

// Scheduled one-off (UTC)
await sendPushToUsers([id1, id2], { title: 'Reminder', message: 'Event in 1h', sendAfter: '2026-07-08T14:00:00Z' })

// Segment
await sendPushToTag({ key: 'plan', value: 'premium' }, { title: 'Premium offer', message: 'Just for you' })

// Clear the badge when the user opens their inbox
await sendPushToSelf({ title: '', message: '', badge: { type: 'SetTo', count: 0 } }) // ⚠ sends a visible push — prefer clearing via a real notification
```

### Tagging (segments)

```js
await setPushTags({ plan: 'premium', last_purchase: '2026-07-01' })   // tag yourself
await setPushTags({ plan: 'free' }, someAccountId)                    // admin: tag another user
```

Tags are plain string key/values stored in OneSignal against the user's `external_id`.
Use them with `sendPushToTag`. Typical uses: plan tier, locale, feature flags, cohorts.

---

## Routing on notification tap

- **`path` (preferred):** Despia updates the URL via `pushState` and fires `popstate`.
  `BrowserRouter` reacts and navigates — works in foreground, background, and cold start
  (Despia buffers the payload until the page is loaded). Nothing to implement.
- **`metadata`:** only needed for state restoration. Define once, early (e.g. `src/main.jsx`):

```js
window.onNotificationEvent = (payload) => {
  // { type: 'open', path?, url?, metadata? }
  if (payload.metadata) {
    const meta = typeof payload.metadata === 'string' ? JSON.parse(payload.metadata) : payload.metadata
    // restore state…
  }
}
```

(Dashboard-sent "Additional Data" arrives as a string; REST-sent `metadata` arrives as an object.)

---

## Backend API

### `sendPush` payload (what the wrappers send)

```jsonc
{
  "token": "<app JWT>",              // injected by invokeAuth
  "target": "self" | "user" | "users" | "all" | "tag",
  "user_id": "…",                    // target 'user'
  "user_ids": ["…"],                 // target 'users'
  "tag": { "key": "plan", "relation": "=", "value": "premium" },  // target 'tag'
  "title": "…", "message": "…",
  "path": "/route", "url": "https://…", "metadata": { },
  "send_after": "2026-01-01T09:00:00Z",
  "delivery_time_of_day": "9:00AM",
  "badge": { "type": "Increase", "count": 1 }
}
```

Security model (enforced server-side, never trust the client):

| Check | Result |
|---|---|
| Missing/invalid/expired JWT | 401 |
| OneSignal secrets not set | 500 with a clear message |
| `target !== 'self'` and caller is not `role: 'admin'` | 403 |
| Missing required fields per target | 400 |
| OneSignal API error | 502 with OneSignal's error detail |

### `pushTags` payload

```jsonc
{ "token": "<app JWT>", "tags": { "plan": "premium" }, "user_id": "optional — admin only" }
```

### Sending from another backend function (server-triggered)

Cron jobs, webhooks, and other functions call OneSignal directly — no JWT hop needed:

```js
await fetch('https://onesignal.com/api/v1/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${Deno.env.get('ONESIGNAL_REST_API_KEY')}` },
  body: JSON.stringify({
    app_id: Deno.env.get('ONESIGNAL_APP_ID'),
    include_external_user_ids: [accountId],   // our Account id
    headings: { en: 'Title' },
    contents: { en: 'Message' },
    data: { path: '/route/to/open' },
    ios_badgeType: 'Increase', ios_badgeCount: 1,
  }),
})
```

Any field from the wrapper table maps 1:1 to OneSignal's
[Create Notification API](https://documentation.onesignal.com/reference/create-notification).

---

## Reusing in a new project (checklist)

1. Copy `base44/functions/sendPush`, `base44/functions/pushTags`, `src/lib/push.js`.
2. Ensure your auth exposes: a JWT (verified the same way) and an `invokeAuth`-style caller
   that injects it — or swap `verifyJwt` for your session check.
3. Call `linkPushUser(<your user id>)` on every authenticated load.
4. Set `ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY` secrets.
5. Enable OneSignal in the Despia Editor (paste the App ID) and **rebuild**.
6. Verify from a debug screen: permission check → link → `sendPushToSelf`.

## Testing & troubleshooting

- `/debug` in the app → permission status + "Send myself a test push" (native build only).
- **Nothing delivers, API says success** → OneSignal not rebuilt into the binary
  (Despia Editor toggle + rebuild), or the App ID in Despia ≠ the `ONESIGNAL_APP_ID` secret.
- **Delivers to some users only** → those devices were never linked (user hasn't opened the
  app since linking shipped — any authenticated load re-links) or permission is denied
  (`checkPushPermission()` → `openDeviceSettings()`).
- **403 from sendPush** → caller isn't `role: 'admin'` and used a non-self target.
- **502 with "All included players are not subscribed"** → the target user has no
  subscribed device; not an error in our code.
- **Tag sends reach nobody** → tags were never set (`setPushTags`) or the filter
  key/value doesn't match exactly (values are strings).