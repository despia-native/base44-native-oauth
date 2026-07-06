# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## What This App Is — Custom Auth for Despia (read before touching auth)

This codebase is a **template for a fully custom authentication system**: native Google Sign-In inside a [Despia](https://despia.com) WebView, plus the app's own HS256 JWT sessions — all running on Base44's backend. It deliberately does **not** use Base44's built-in `base44.auth` for login. Users live in a custom `Account` entity, and every login path mints an app-signed JWT.

**Before changing anything auth-related, read these docs:**

- **`TEMPLATE_SETUP.md`** — the per-project checklist (deep-link scheme, secrets, Google/Despia setup).
- **`DESPIA_OAUTH.md`** — the full mental model: why WebViews break normal OAuth, the authorization-code exchange flow (single-use Google code → server-side exchange → our JWT), how the `oauth://` native bridge and `<scheme>://oauth/auth` deep link differ, JWT sessions, and security notes.

Key auth pieces: `src/config/app-config.js` (deep-link config), `src/lib/customAuth.js`, `src/lib/AuthContext.jsx`, `src/pages/Auth.jsx`, `public/native-callback.html`, and the backend functions (`authRegister`, `authLogin`, `googleSignIn`, `authMe`, `authRequestReset`, `authResetPassword`, `googleAuthUrl`, `adminUsers`). Don't replace this with `base44.auth` — the custom design is intentional.

## UI / UX — Native-First Design Rules (read before touching UI)

**Hard rule:** the app must always look and feel like a native iOS/Android app,
never a wrapped website. Before creating or editing ANY screen or component,
**read `DESIGN_GUIDELINES.md`** — it defines the mandatory app shell (no body
scroll, `.scroll-container`), safe-area rules, the ember material system,
responsive `.page-wrap` caps for iPad/desktop, touch/haptic/motion standards,
and the new-screen checklist. Only design tokens and ember materials — never
hardcoded colors, hover-only feedback, browser dialogs, or unwrapped
full-width layouts on tablet.

## DB Security — Deny-All RLS on EVERY Entity (read before touching data)

**Hard rule:** no direct database access from the client — all entity access goes
through backend functions (verify app JWT → `base44.asServiceRole`). Every entity,
existing or new, MUST include the deny-all `rls` block. **Read `DB_SECURITY.md`**
for the exact block, the rationale, and the new-entity checklist. Never add
`base44.entities.*` calls in frontend code, and never create an entity schema
without the deny-all RLS block.

## Despia Native Features — ALWAYS query the live docs

This app runs inside a Despia native shell with 50+ native capabilities (push, biometrics, camera, haptics, IAP, geolocation, …). See **`DESPIA_NATIVE.md`** for the agent workflow.

**Rule:** before implementing ANY Despia native feature, **fetch https://setup.despia.com** (or its machine index https://setup.despia.com/llms.txt) and confirm the exact `despia(...)` bridge command + setup. Never guess Despia APIs from memory — the live docs are the source of truth.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.