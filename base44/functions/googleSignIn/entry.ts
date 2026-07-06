// Custom auth — Google sign-in (authorization code flow).
// Exchanges the single-use Google auth code server-side (the client secret never
// leaves the backend), reads the verified identity from the returned id_token,
// finds/creates an Account, and returns OUR own signed JWT.
// No Base44 auth involved — Accounts is our user DB.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64url(bytes) {
  let str = typeof bytes === 'string' ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function signJwt(payload, secret, expiresInSec = 60 * 60 * 24 * 30) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const enc = new TextEncoder();
  const data = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(body))}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64url(sig)}`;
}
// Decode a JWT payload without signature verification — safe here because the
// id_token arrives directly from Google's token endpoint over TLS, server-to-server.
function decodeJwtPayload(jwt) {
  let b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return JSON.parse(atob(b64));
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    let { google_code } = await req.json();
    if (!google_code) return Response.json({ error: 'google_code is required' }, { status: 400 });
    // Defense: native layers sometimes re-encode the deep link, so the code can
    // arrive percent-encoded (4%2F0A…). Real Google codes never contain '%'.
    if (google_code.includes('%')) {
      try { google_code = decodeURIComponent(google_code); } catch { /* keep as-is */ }
    }

    // Exchange the code for tokens. redirect_uri must exactly match the one used
    // in googleAuthUrl and registered in Google Cloud Console.
    const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://despia-connect-go.base44.app';
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: google_code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
        redirect_uri: `${APP_BASE_URL}/native-callback.html`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      return Response.json({ error: tokenData.error_description || tokenData.error || 'Google code exchange failed' }, { status: 401 });
    }

    const tokenInfo = decodeJwtPayload(tokenData.id_token);
    if (!tokenInfo.email) return Response.json({ error: 'Google account has no email' }, { status: 401 });
    // The id_token must be issued FOR THIS APP.
    if (tokenInfo.aud !== Deno.env.get('GOOGLE_CLIENT_ID')) {
      return Response.json({ error: 'Token not issued for this app' }, { status: 401 });
    }

    const email = tokenInfo.email.toLowerCase().trim();
    const base44 = createClientFromRequest(req);

    let accounts = await base44.asServiceRole.entities.Account.filter({ email });
    let account = accounts?.[0];

    if (!account) {
      account = await base44.asServiceRole.entities.Account.create({
        email,
        full_name: tokenInfo.name || email.split('@')[0],
        google_id: tokenInfo.sub || '',
        avatar_url: tokenInfo.picture || '',
        email_verified: true,
        role: 'user',
        last_login_at: new Date().toISOString(),
      });
    } else {
      // Keep Google link + verified state fresh on returning logins
      await base44.asServiceRole.entities.Account.update(account.id, {
        google_id: account.google_id || tokenInfo.sub || '',
        avatar_url: account.avatar_url || tokenInfo.picture || '',
        email_verified: true,
        last_login_at: new Date().toISOString(),
      });
    }

    const secret = Deno.env.get('JWT_SECRET');
    const token = await signJwt({ sub: account.id, email: account.email, role: account.role }, secret);

    return Response.json({
      token,
      account: { id: account.id, email: account.email, full_name: account.full_name, role: account.role, avatar_url: account.avatar_url || tokenInfo.picture || null },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});