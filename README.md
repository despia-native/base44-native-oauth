# Despia Native Auth Template (on Base44)

This codebase is a **working template for a fully custom authentication system**: native Google Sign-In inside a [Despia](https://despia.com) WebView app, plus your own JWT sessions — all running on [Base44](https://base44.com)'s serverless backend (Deno functions + entities + email).

Instead of Base44's built-in `base44.auth`, this app owns its entire auth stack: users live in a normal `Account` entity you control, sessions are your own signed JWTs, and Google login works natively in Despia via the `oauth://` bridge. You still get Base44's zero-ops backend and database.

**📖 Start here:**
- [`TEMPLATE_SETUP.md`](./src/TEMPLATE_SETUP.md) — the checklist of what to change to make this app yours (3 spots: config, secrets, external accounts).
- [`DESPIA_OAUTH.md`](./src/DESPIA_OAUTH.md) — the full mental model and how Despia, Base44, and Google fit together.
- [`JWT_AUTH.md`](./JWT_AUTH.md) — **the authentication system.** Custom JWT sessions, the `Account` entity, password hashing, Google/Apple/device sign-in, and the guest session model. This is the single source of truth for auth.

---

## 🧩 Main dependency: Despia

**[Despia](https://despia.com) is the primary runtime dependency of this app.** The app is built to run inside Despia's native iOS/Android WebView shell, and several core features only work there:

| Feature | Despia mechanism |
|---|---|
| Native Google Sign-In | `oauth://` bridge → secure in-app browser → deep link back (`myapp://oauth/auth`) |
| Session persistence across reinstalls | Despia **Storage Vault** (`src/lib/tokenVault.js`) |
| Anonymous guest accounts | Stable device UUID from the vault (`src/lib/deviceAuth.js`) |
| Push notifications | Despia push bridge (`src/lib/push.js`, `sendPush` function) |
| Haptics | `despia-native` package (`src/lib/haptics.js`) |
| Instant boot / offline / OTA updates | `@despia/local` Vite plugin — the web build is served from `http://localhost` on-device |
| Safe areas / native chrome | `--safe-area-*` variables injected by the shell |

Packages: **`despia-native`** (runtime bridge) and **`@despia/local`** (local-server build, wired in `vite.config.js`). In a plain browser the app still runs (web preview), but native-only features gracefully fall back.

## 🔐 Authentication — fully custom, not Base44 login

This app does **not** use Base44's built-in login, SSO, or `base44.auth` sessions. Authentication is entirely self-owned:

- Users live in the **`Account` entity**; sessions are our own **HS256 JWTs** signed with `JWT_SECRET`.
- Sign-in methods: email/password, Google (native OAuth), Apple, and automatic anonymous device accounts.
- Backend: the `auth*`, `googleSignIn`, `appleSignIn`, and `deviceSignIn` functions. Frontend: `src/lib/customAuth.js` + `src/lib/AuthContext.jsx`.
- Required secrets: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`. Any `sso_*` secrets are legacy Base44-SSO leftovers and are **not used** — they can be deleted.

Full details, flows, and security practices: [`JWT_AUTH.md`](./JWT_AUTH.md).

> ℹ️ **Keep the Base44 setup below intact.** This project runs *on* Base44 — the CLI, config, and hosted-backend steps are how you run, edit, and publish it. Removing them breaks the project.

---

## Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) if you want to run Base44 commands directly.

## Run Locally

Run the full local development environment from the project root:

```bash
base44 dev
```

`base44 dev` starts the local Base44 development backend and, when this app is configured for it, also starts the frontend dev server for you. Use the frontend URL printed by the command.

For example, when the Base44 project config includes a `serveCommand`, `base44 dev` can launch the frontend too:

```json5
{
  "site": {
    "serveCommand": "npm run dev"
  }
}
```

In a Base44 project this lives in `base44/config.jsonc`.

## Run Only The Frontend

If you only want to work on the frontend against the hosted Base44 backend, run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Use The Hosted Backend

For frontend-only development, create or update `.env.local` in the project root:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

`VITE_BASE44_APP_ID` identifies the Base44 app.

`VITE_BASE44_APP_BASE_URL` tells the Base44 Vite plugin where to send local `/api` requests. Point it at your deployed Base44 app URL when you want the local frontend to use the hosted backend.

When you use `base44 dev`, the command injects the local Base44 values for you, so `.env.local` is mainly needed for frontend-only workflows.

## Publish Your Changes

After pushing your changes to git, open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

## Docs & Support

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Base44 CLI command reference: [https://docs.base44.com/developers/references/cli/commands/introduction](https://docs.base44.com/developers/references/cli/commands/introduction)

Support: [https://app.base44.com/support](https://app.base44.com/support)