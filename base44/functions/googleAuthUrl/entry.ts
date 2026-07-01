import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { deeplink_scheme } = await req.json();
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');

    // ✏️ Replace with your Base44 app's public URL if it changes
    const APP_BASE_URL = 'https://despia-connect-go.base44.app';
    // redirectUri must exactly match what's registered in Google Cloud Console — no query params
    const redirectUri = `${APP_BASE_URL}/native-callback.html`;

    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid email profile',
      // deeplink_scheme travels via state so the redirect URI stays clean
      state: deeplink_scheme,
    });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});