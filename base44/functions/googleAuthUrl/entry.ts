import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { deeplink_scheme } = await req.json();
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const redirectUri = `https://${req.headers.get('host')}/native-callback.html?deeplink_scheme=${encodeURIComponent(deeplink_scheme)}`;

    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid email profile',
    });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});