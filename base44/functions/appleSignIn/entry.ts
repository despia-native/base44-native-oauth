// Custom auth — Sign In with Apple.
// Verifies the Apple id_token against Apple's public JWKS, finds/creates an
// Account, returns OUR own signed JWT (same session model as googleSignIn).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// 🔧 TEMPLATE: your Apple "Sign In with Apple" Services ID (the clientId used by
// the Apple JS SDK). Set the APPLE_SERVICES_ID secret in Dashboard → Settings →
// Environment Variables, or edit this fallback. Must match src/config/app-config.js.
const APPLE_SERVICES_ID_FALLBACK = 'com.yourcompany.yourapp.webauth';

function b64urlToStr(input) {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}
// Decode a base64url segment straight to bytes. The signature is never compared
// manually — verification is fully delegated to crypto.subtle.verify, which
// performs the cryptographic comparison in constant time.
function b64urlToBytes(input) {
  const bin = b64urlToStr(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
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

// Verify the Apple id_token: RS256 signature via Apple's JWKS + iss/aud/exp claims.
async function verifyAppleIdToken(idToken, clientId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed Apple token');
  const header = JSON.parse(b64urlToStr(parts[0]));
  const payload = JSON.parse(b64urlToStr(parts[1]));

  const jwksRes = await fetch('https://appleid.apple.com/auth/keys');
  if (!jwksRes.ok) throw new Error('Could not fetch Apple signing keys');
  const jwks = await jwksRes.json();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown Apple signing key');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const sig = b64urlToBytes(parts[2]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('Invalid Apple token signature');

  if (payload.iss !== 'https://appleid.apple.com') throw new Error('Wrong token issuer');
  // Critical: the token must be issued FOR THIS APP (our Services ID).
  if (payload.aud !== clientId) throw new Error('Token not issued for this app');
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Apple token expired');
  return payload;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { apple_id_token, full_name } = await req.json();
    if (!apple_id_token) return Response.json({ error: 'apple_id_token is required' }, { status: 400 });

    const clientId = Deno.env.get('APPLE_SERVICES_ID') || APPLE_SERVICES_ID_FALLBACK;
    let payload;
    try {
      payload = await verifyAppleIdToken(apple_id_token, clientId);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 401 });
    }

    const appleSub = payload.sub;
    // Apple includes email (real or private relay) when the email scope was granted.
    const email = (payload.email || `apple-${appleSub}@apple.local`).toLowerCase().trim();

    const base44 = createClientFromRequest(req);

    // Look up by Apple identity first, then by email (links Apple to an existing account).
    let accounts = await base44.asServiceRole.entities.Account.filter({ apple_id: appleSub });
    let account = accounts?.[0];
    if (!account) {
      accounts = await base44.asServiceRole.entities.Account.filter({ email });
      account = accounts?.[0];
    }

    if (!account) {
      account = await base44.asServiceRole.entities.Account.create({
        email,
        // Apple only sends the name on the very first sign-in — capture it now.
        full_name: (full_name || '').trim() || email.split('@')[0],
        apple_id: appleSub,
        email_verified: payload.email_verified === true || payload.email_verified === 'true',
        role: 'user',
        last_login_at: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.Account.update(account.id, {
        apple_id: account.apple_id || appleSub,
        full_name: account.full_name || (full_name || '').trim() || email.split('@')[0],
        last_login_at: new Date().toISOString(),
      });
    }

    const secret = Deno.env.get('JWT_SECRET');
    if (!secret || secret.length < 32) {
      return Response.json({ error: 'Server auth is not configured' }, { status: 500 });
    }
    const token = await signJwt({ sub: account.id, email: account.email, role: account.role }, secret);

    return Response.json({
      token,
      account: { id: account.id, email: account.email, full_name: account.full_name, role: account.role, avatar_url: account.avatar_url || null },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});