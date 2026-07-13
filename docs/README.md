# 📚 Project Documentation Index

All project documentation lives in this `docs/` folder. Start with the doc that
matches what you're about to touch.

## Start here

| Doc | Read when |
|---|---|
| [`TEMPLATE_SETUP.md`](./TEMPLATE_SETUP.md) | Making this template your own — config, secrets, external accounts |
| [`DESIGN_GUIDELINES.md`](./DESIGN_GUIDELINES.md) | Creating or editing ANY screen/component (mandatory native-first UI rules) |

## Authentication & users

| Doc | Covers |
|---|---|
| [`JWT_AUTH.md`](./JWT_AUTH.md) | The custom auth system — JWT sessions, secrets, session model (single source of truth) |
| [`DESPIA_OAUTH.md`](./DESPIA_OAUTH.md) | Native Google OAuth in a WebView — mental model, deep links, full walkthrough |
| [`APPLE_SIGN_IN.md`](./APPLE_SIGN_IN.md) | Sign In with Apple — console setup, ID swap, flows, troubleshooting |
| [`GOOGLE_LOGIN_BASE44_LIMITATIONS.md`](./GOOGLE_LOGIN_BASE44_LIMITATIONS.md) | Why built-in Base44 auth couldn't be used (platform limitations) |
| [`ACCOUNT_DELETION.md`](./ACCOUNT_DELETION.md) | Store-compliant account deletion (anonymize vs hard delete) |

## Data & backend

| Doc | Covers |
|---|---|
| [`DB_SECURITY.md`](./DB_SECURITY.md) | Deny-all RLS on every entity — the mandatory data-access pattern |
| [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md) | OneSignal push — setup, client API, backend, troubleshooting |

## Frontend & UI

| Doc | Covers |
|---|---|
| [`ROUTER.md`](./ROUTER.md) | Folder-driven routing, iOS-style transitions, swipe-back, auth guarding |
| [`ICONS.md`](./ICONS.md) | Framework7 Icons system — `F7Icon`, icon vocabulary, adding icons |
| [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) | WCAG 2.1 AA standard & new-screen checklist |
| [`DOM_OPTIMIZATION.md`](./DOM_OPTIMIZATION.md) | Animation & WebView performance rules (GPU-only, rAF batching) |

## Native shell (Despia)

| Doc | Covers |
|---|---|
| [`DESPIA_NATIVE.md`](./DESPIA_NATIVE.md) | Working with Despia native features — always query the live docs first |
| [`ANTI_FREEZE.md`](./ANTI_FREEZE.md) | Never-block-the-UI rules for native bridge calls |