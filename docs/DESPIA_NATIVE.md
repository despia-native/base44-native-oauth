# Despia Native Features — Agent Reference

This app is wrapped in a [Despia](https://despia.com) native shell (iOS/Android WebView). Beyond the custom Google auth documented in [`DESPIA_OAUTH.md`](./DESPIA_OAUTH.md), Despia exposes **50+ native capabilities** to the web app — push notifications, biometrics, camera, haptics, in-app purchases, geolocation, deep links, and more.

## ⚠️ Rule for AI agents

**Before implementing ANY Despia native feature, you MUST query the live docs:**

👉 **https://setup.despia.com**

Do not rely on memory or guess API shapes — Despia's bridge commands and setup steps change, and the live docs are the single source of truth. Fetch the relevant page, confirm the exact `despia(...)` command / setup for the feature, then implement.

## How Despia is called from the web app

Native features are triggered through the `despia-native` npm package (already installed):

```js
import despia from 'despia-native'

// Example pattern — ALWAYS confirm the exact command string on setup.despia.com first:
despia('somefeature://?param=value')
```

Detect the native shell (some features only exist there):

```js
const isDespia = navigator.userAgent.toLowerCase().includes('despia')
```

## Reference links (agents: query these, don't guess)

- **Setup & all native features:** https://setup.despia.com  ← primary, always check first
- **Machine-readable index (llms.txt):** https://setup.despia.com/llms.txt
- **MCP server:** https://setup.despia.com/mcp
- **npm package:** https://www.npmjs.com/package/despia-native
- **Despia website:** https://despia.com

## Workflow for a native-feature request

1. **Fetch** the relevant page under https://setup.despia.com (or `llms.txt` for the index).
2. **Confirm** the exact bridge command, required params, and any Despia dashboard setup.
3. **Implement** using `despia-native`, guarding with the `isDespia` check where the feature is native-only.
4. **Note** any Despia dashboard / build configuration the user must apply on their side.