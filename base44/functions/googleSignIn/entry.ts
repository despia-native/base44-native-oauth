// Custom auth — Google sign-in.
// Verifies the Google access token, finds/creates an Account, returns OUR own signed JWT.
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

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { google_token } = await req.json();
    if (!google_token) return Response.json({ error: 'google_token is required' }, { status: 400 });

    // Verify the Google token with Google's tokeninfo endpoint
    const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${google_token}`);
    if (!tokenInfoRes.ok) return Response.json({ error: 'Invalid Google token' }, { status: 401 });

    const tokenInfo = await tokenInfoRes.json();
    if (!tokenInfo.email || tokenInfo.error_description) {
      return Response.json({ error: tokenInfo.error_description || 'Token missing email scope' }, { status: 401 });
    }

    // Critical: the token must be issued FOR THIS APP. Without this, any valid Google
    // access token with email scope — including tokens minted by a different app the
    // user authorized — would authenticate here. tokeninfo returns the client id in `aud`.
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