# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## What This App Is — Custom Auth for Despia (read before touching auth)

This codebase is a **template for a fully custom authentication system**: native Google Sign-In inside a [Despia](https://despia.com) WebView, plus the app's own HS256 JWT sessions — all running on Base44's backend. It deliberately does **not** use Base44's built-in `base44.auth` for login. Users live in a custom `Account` entity, and every login path mints an app-signed JWT.

**Before changing anything auth-related, read these docs:**

- **`TEMPLATE_SETUP.md`** — the per-project checklist (deep-link scheme, secrets, Google/Despia setup).
- **`DESPIA_OAUTH.md`** — the full mental model: why WebViews break normal OAuth, the two-token flow, how the `oauth://` native bridge and `<scheme>://oauth/auth` deep link differ, JWT sessions, and security notes.

Key auth pieces: `src/config/app-config.js` (deep-link config), `src/lib/customAuth.js`, `src/lib/AuthContext.jsx`, `src/pages/Auth.jsx`, `public/native-callback.html`, and the backend functions (`authRegister`, `authLogin`, `googleSignIn`, `authMe`, `authRequestReset`, `authResetPassword`, `googleAuthUrl`, `adminUsers`). Don't replace this with `base44.auth` — the custom design is intentional.

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