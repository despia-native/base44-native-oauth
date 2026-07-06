# Account Deletion — Design & Compliance

How "Delete account" works in this app, why it works that way, and what you must
maintain when you add new data entities.

## The problem this solves

On native (Despia) every install always has a **device account**: an anonymous
`Account` record keyed by a stable `device_id` stored in the native Storage
Vault (survives uninstall/reinstall). When the user signs up or signs in with
email / Google / Apple **on that device**, the same record is *linked* — it
gains a real email, name, and identity fields, and `is_anonymous` flips to
`false`.

**RevenueCat in-app purchases are keyed to that record's `id`** (it is passed
as `external_id` to `revenuecat://launchPaywall` and the Customer Center). If
account deletion simply removed the row:

- The device would create a **new** anonymous account (new `id`) on next launch.
- RevenueCat entitlements attached to the old `id` would be orphaned →
  **the user loses access to purchases they paid for**, which violates
  App Store expectations and generates refunds/complaints.

## The two deletion modes (backend: `authDeleteAccount`)

### 1. Anonymize — account has a `device_id` (is/was a device account)

The record is **kept** but reverted to a pristine guest ("linked → unlinked"):

| Field            | After deletion                          |
| ---------------- | --------------------------------------- |
| `email`          | `device-<device_id>@anon.local` (synthetic, no PII) |
| `full_name`      | `Guest`                                 |
| `password_hash`  | cleared                                 |
| `google_id`      | cleared                                 |
| `apple_id`       | cleared                                 |
| `avatar_url`     | cleared                                 |
| `email_verified` | `false`                                 |
| `is_anonymous`   | `true`                                  |
| `role`           | `user` (admin rights are revoked)       |
| `id`, `device_id`| **unchanged** — preserves RevenueCat entitlements |

On the next app launch the device's automatic guest sign-in finds the same
record by `device_id` and the user continues as a fresh guest — with their
in-app purchases intact (also restorable any time via the store's
Restore Purchases, since IAPs ultimately belong to the Apple ID / Google
account).

### 2. Hard delete — no `device_id` (web-only account)

A web account never bound to a device has no IAP/device identity to preserve,
so the record is deleted outright.

## Why this is compliant

- **Apple App Store Guideline 5.1.1(v)** requires apps with account creation to
  offer in-app account deletion that removes **the account and associated
  personal data**. Anonymization satisfies this: after deletion, zero personal
  data remains — the surviving row contains only a random device UUID and a
  synthetic address. Apple explicitly cautions against flows that strip users
  of paid content; preserving entitlements on the anonymous device identity is
  the recommended pattern for apps with anonymous/device accounts.
- **Google Play data-deletion policy**: same reasoning — all user-provided and
  identity data is erased.
- **GDPR / "right to erasure"**: a random device UUID with no linkage to a
  person is not personal data once every identifying field is wiped.
- **Not "deactivation"**: the account cannot be recovered — the email, password
  and social identities are gone. Signing in again with the same email creates
  a brand-new account.

## Frontend flow

1. `src/components/account/DeleteAccountDrawer.jsx` — two-step confirmation:
   warning → identity check with the account's **original sign-in method**
   (reported by `authMe` as `auth_methods`):
   - **Password** account → re-enter the password (verified via `authLogin`).
   - **Google** account → re-authenticate with Google. The OAuth round-trip is
     flagged via `localStorage` (`reauth_delete`, see `src/lib/reauth.js`);
     `/auth` (`src/pages/Auth.jsx`) then calls `authReauth` — which verifies the
     returned Google identity **matches this exact account** — and only then
     deletes. Picking a different Google account is rejected.
   - **Apple** account → re-authenticate with Apple. iOS/web: native popup
     returns the `id_token` inline → `authReauth` → delete. Android: deeplink
     round-trip through `/auth`, same as Google.
   - **Guest** (no method) → Face ID / Touch ID via locked Storage Vault on
     native; type-DELETE on web.
2. `customAuth.deleteAccount()` calls `authDeleteAccount` with the session JWT.
3. `src/pages/Account.jsx` → `handleDeleted()`:
   - removes the account from the device's saved-account switcher, and
   - `logout()` clears the session (localStorage + native vault token).
4. On native, the login screen's automatic device sign-in then signs the user
   straight back in **as the (now anonymous) guest** — the "unlinked" state.

Note: the session JWT of an anonymized account remains technically valid until
expiry (it points at the same record id), but it now resolves to the guest
account containing no personal data — nothing sensitive is exposed.

## ⚠️ When you add new entities (maintenance contract)

`authDeleteAccount` is the single place where user data is erased. **Every new
entity that stores user data keyed to an account MUST be wiped there**, before
the anonymize/delete step:

```js
await base44.asServiceRole.entities.YourEntity.deleteMany({ account_id: account.id });
```

Skipping this leaves orphaned personal data after deletion — a store-review and
GDPR violation.