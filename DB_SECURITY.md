# DB Security Rule — Deny-All RLS on Every Entity (MANDATORY)

## The Rule

**No direct database access from the client — ever.** Every entity (database
table) in this app MUST be locked down with deny-all Row Level Security (RLS)
so that ALL data access flows exclusively through backend functions using the
service role, after the app's own JWT has been verified.

This applies to:

- The existing `Account` entity (already locked — see `base44/entities/Account.jsonc`).
- **Every future entity** (tasks, posts, settings, anything). No exceptions.
  A new entity is NOT done until its schema includes the deny-all `rls` block below.

## Why

- This app uses **custom JWT auth** (see `JWT_AUTH.md`), not Base44's built-in
  auth. App users are therefore *anonymous* to the Base44 data layer — any
  permissive RLS would expose data to the whole internet, not "logged-in users".
- Entities can hold sensitive data (e.g. `Account` stores password hashes and
  Google/Apple identity IDs). Client-side reads can never be allowed.
- Centralizing access in backend functions means authorization is enforced in
  exactly one place: verify the app JWT → act via `base44.asServiceRole`.

## The Required RLS Block

Copy this verbatim into the top level of every entity `.jsonc` schema:

```jsonc
"rls": {
  "create": { "user_condition": { "role": "__service_only__" } },
  "read": false,
  "update": { "user_condition": { "role": "__service_only__" } },
  "delete": false
}
```

Notes on this exact shape (do not "simplify" it):

- `"read": false` and `"delete": false` are hard denials — enforced by the platform.
- `"create": false` / `"update": false` are **NOT enforced** by the platform's
  single-record write gate (stored `false` is treated as allow-all there).
  That's why create/update use an impossible `user_condition` — no user ever
  has the role `__service_only__`, so these operations are denied for everyone.
- `base44.asServiceRole` in backend functions **bypasses RLS** — that is the
  one and only sanctioned data path.

## The Only Allowed Data Access Pattern

```
Frontend  →  backend function (base44.functions.invoke)
          →  verify app JWT (JWT_SECRET, HS256)
          →  base44.asServiceRole.entities.X  →  database
```

Forbidden everywhere in frontend code:

- `base44.entities.X.*` (list/filter/get/create/update/delete/subscribe)
- Any new code path that reads or writes entities without going through a
  backend function.

## Checklist When Adding a New Entity

1. Write the schema in `base44/entities/<Name>.jsonc` **with the deny-all
   `rls` block** included from the very first version.
2. Create/extend backend functions for every operation the app needs,
   verifying the app JWT first (copy the `verifyJwt` pattern from
   `base44/functions/authMe/entry.ts`).
3. If records are keyed to an account, add cleanup in
   `base44/functions/authDeleteAccount/entry.ts` (see the marked section) so
   account deletion wipes the user's rows — required for App Store / Play
   Store compliance.
4. Never add frontend `base44.entities.*` calls for it.