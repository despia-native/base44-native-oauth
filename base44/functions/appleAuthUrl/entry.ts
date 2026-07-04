// Builds the Apple OAuth URL for the Android Chrome Custom Tabs flow.
// Apple redirects to native-callback.html, which deeplinks the id_token back
// into the WebView (scheme://oauth/auth?id_token=...).

// 🔧 TEMPLATE: your Apple Services ID — set the APPLE_SERVICES_ID secret or edit
// this fallback. Must match src/config/app-config.js and appleSignIn/entry.ts.
const APPLE_SERVICES_ID_FALLBACK = 'com.yourcompany.yourapp.webauth';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { deeplink_scheme } = await req.json();
    const clientId = Deno.env.get('APPLE_SERVICES_ID') || APPLE_SERVICES_ID_FALLBACK;

    // 🔧 TEMPLATE: set the APP_BASE_URL secret to your app's public URL.
    const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://despia-connect-go.base44.app';
    // Must exactly match the return URL registered in the Apple Developer Console.
    const redirectUri = `${APP_BASE_URL}/native-callback.html`;

    const url = 'https://appleid.apple.com/auth/authorize?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code id_token',
      scope: 'name email',
      response_mode: 'fragment',
      // deeplink_scheme travels via state so the redirect URI stays clean
      state: deeplink_scheme,
    });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});