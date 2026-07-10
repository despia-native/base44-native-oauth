// Custom auth — re-verify the CURRENT user's identity with their original
// sign-in method, without changing the session. Used before destructive
// actions (account deletion): Google accounts re-auth with Google, Apple with
// Apple. (Password accounts re-verify via authLogin — not handled here.)
//
// Input: { token, google_code? } OR { token, apple_id_token? }
// The proof must match THIS account's linked identity — a different Google/
// Apple account is rejected.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APPLE_SERVICES_ID_FALLBACK = 'com.yourcompany.yourapp.webauth';

function fromB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}
async function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = Uint8Array.from(fromB64url(sigB64), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${headerB64}.${bodyB64}`));
  if (!valid) return null;
  const payload = JSON.parse(fromB64url(bodyB64));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
function decodeJwtPayload(jwt) {
  return JSON.parse(fromB64url(jwt.split('.')[1]));
}

// Verify the Apple id_token: RS256 signature via Apple's JWKS + iss/aud/exp claims.
async function verifyAppleIdToken(idToken, clientId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed Apple token');
  const header = JSON.parse(fromB64url(parts[0]));
  const payload = JSON.parse(fromB64url(parts[1]));
  const jwksRes = await fetch('https://appleid.apple.com/auth/keys');
  if (!jwksRes.ok) throw new Error('Could not fetch Apple signing keys');
  const jwks = await jwksRes.json();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown Apple signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const sig = Uint8Array.from(fromB64url(parts[2]), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('Invalid Apple token signature');
  if (payload.iss !== 'https://appleid.apple.com') throw new Error('Wrong token issuer');
  if (payload.aud !== clientId) throw new Error('Token not issued for this app');
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Apple token expired');
  return payload;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const body = await req.json().catch(() => ({}));
    const token = req.headers.get('x-app-token') || body.token;
    if (!token) return Response.json({ error: 'No token provided' }, { status: 401 });

    const secret = Deno.env.get('JWT_SECRET');
    if (!secret || secret.length < 32) {
      return Response.json({ error: 'Server auth is not configured' }, { status: 500 });
    }
    const session = await verifyJwt(token, secret);
    if (!session) return Response.json({ error: 'Invalid or expired token' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const account = await base44.asServiceRole.entities.Account.get(session.sub).catch(() => null);
    if (!account) return Response.json({ error: 'Account not found' }, { status: 401 });

    // ── Google proof: exchange the one-time code, sub/email must match THIS account ──
    if (body.google_code) {
      let code = body.google_code;
      if (code.includes('%')) { try { code = decodeURIComponent(code); } catch { /* keep */ } }
      const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || req.headers.get('origin') || 'https://despia-connect-go.base44.app';
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
          redirect_uri: `${APP_BASE_URL}/native-callback.html`,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.id_token) {
        return Response.json({ error: tokenData.error_description || tokenData.error || 'Google verification failed' }, { status: 401 });
      }
      const info = decodeJwtPayload(tokenData.id_token);
      if (info.aud !== Deno.env.get('GOOGLE_CLIENT_ID')) {
        return Response.json({ error: 'Token not issued for this app' }, { status: 401 });
      }
      if (info.iss !== 'https://accounts.google.com' && info.iss !== 'accounts.google.com') {
        return Response.json({ error: 'Wrong token issuer' }, { status: 401 });
      }
      if (info.exp && info.exp < Math.floor(Date.now() / 1000)) {
        return Response.json({ error: 'Google token expired' }, { status: 401 });
      }
      const subMatch = account.google_id && info.sub === account.google_id;
      const emailMatch = info.email && info.email.toLowerCase().trim() === account.email;
      if (!subMatch && !emailMatch) {
        return Response.json({ error: 'That Google account does not match this account.' }, { status: 403 });
      }
      return Response.json({ verified: true });
    }

    // ── Apple proof: verify the id_token, sub must match THIS account ──
    if (body.apple_id_token) {
      const clientId = Deno.env.get('APPLE_SERVICES_ID') || APPLE_SERVICES_ID_FALLBACK;
      let payload;
      try {
        payload = await verifyAppleIdToken(body.apple_id_token, clientId);
      } catch (e) {
        return Response.json({ error: e.message }, { status: 401 });
      }
      if (!account.apple_id || payload.sub !== account.apple_id) {
        return Response.json({ error: 'That Apple ID does not match this account.' }, { status: 403 });
      }
      return Response.json({ verified: true });
    }

    return Response.json({ error: 'No identity proof provided' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});