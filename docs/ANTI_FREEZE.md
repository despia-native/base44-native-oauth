# ANTI_FREEZE.md — Never Let a Native Call Freeze the UI

**Hard rule:** no button, spinner, or flow may stay blocked waiting on a
`despia(...)` bridge call. The Despia bridge has **no guaranteed callback** —
if the native side never answers (feature disabled in the shell, older app
build, web preview, OS quirk), an awaited call hangs for **15–30 seconds**
until the SDK gives up. A frozen button for 30 seconds reads as a crashed app
and is an App Store rejection risk.

## The two tools (`src/lib/antiFreeze.js`)

### 1. `raceTimeout(promise, fallback, ms = 2000)` — cap any await

Use for every awaited `despia(...)` call whose result you read (vault reads,
entitlement checks, permission checks). If the bridge doesn't answer within
`ms`, you get `fallback` and the flow continues; the original call keeps
running in the background and its late result is ignored.

```js
import { raceTimeout } from '@/lib/antiFreeze'

// Bridge dead → data === null after 2s instead of hanging for 30s.
const data = await raceTimeout(despia('readvault://?key=k', ['k']), null)
```

Pick a `fallback` that means "unknown / not available" for the caller
(`null`, `[]`, `false`) — never one that fakes success.

### 2. `withCappedBusy(setBusy, task, capMs = 2000)` — cap button busy states

Use whenever a button shows a spinner / disabled state around a native call.
The busy state is force-released after **2 seconds hard-coded**, the button
returns to normal, and the task **keeps running in the background** — if the
callback arrives late (e.g. the user is slow at a Face ID prompt), its result
still applies.

```js
import { withCappedBusy } from '@/lib/antiFreeze'

const handleConfirm = () => {
  withCappedBusy(setBusy, async () => {
    const ok = await confirmWithLockedVault() // may take >2s — that's fine
    if (ok) await doTheThing()                // still runs when it resolves
  })
}
```

## Rules

1. **Never await a raw `despia(...)` call that you read a result from** —
   always wrap in `raceTimeout`. Prefer wrapping inside the lib module
   (`src/lib/tokenVault.js`, `src/lib/push.js`, …) so every caller is safe.
2. **Never tie a button's disabled/spinner state directly to a native await.**
   Wrap the handler in `withCappedBusy` — busy for ≤2s, work continues in the
   background.
3. **Fire-and-forget calls need nothing** (`haptics`, `settingsapp://`,
   `oauth://`, paywall launches) — don't await them, don't show busy states.
4. **Exception — system prompts:** a call that shows a *system* UI on top of
   the app (Face ID via locked vault read) may be awaited without a timeout,
   because the OS prompt covers the screen; but the *button* behind it must
   still use `withCappedBusy`.
5. **Timeout fallbacks are "unknown", not "success".** Never let a timed-out
   call pretend the operation worked.
6. **Boot/background reads too:** session restore, entitlement refresh, and
   permission checks run through the same wrapped lib functions so app startup
   can never hang on a dead bridge.

## Already-wrapped modules (use these, don't call `despia` directly)

| Module | Calls | Behavior on dead bridge |
|---|---|---|
| `src/lib/tokenVault.js` | vault read/write | resolves `null` / no-op after 2s |
| `src/lib/deviceAuth.js` | device-id vault read/write | falls through to fresh id after 2s |
| `src/lib/biometricConfirm.js` | locked-vault biometric confirm | nonce write capped; prompt read awaited (system UI) |
| `src/lib/push.js` | permission check | resolves `null` (unknown) after 2s |
| `src/lib/revenuecat.js` | entitlement check | resolves `[]` after 2s |

## New-code checklist

- [ ] Reading a `despia(...)` result? → `raceTimeout(call, fallback)`.
- [ ] Button spinner around a native call? → `withCappedBusy(setBusy, task)`.
- [ ] Fallback value means "unknown", and the UI handles it gracefully.
- [ ] Late results are either applied safely or harmless to ignore.