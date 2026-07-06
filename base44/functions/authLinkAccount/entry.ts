// Custom auth — upgrade / link an anonymous device account to a real login.
// Verifies the current (anonymous) session JWT, then attaches either
// email+password credentials or a Google identity to the SAME Account record,
// so all data created as a guest is preserved. Returns a fresh JWT.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64url(bytes) {
  const str = typeof bytes === 'string' ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
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

// Same PBKDF2 scheme as authRegister — salt:hash hex, 100k iterations.
function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return `${toHex(salt)}:${toHex(bits)}`;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    let { token, email, password, full_name, google_code } = await req.json();
    if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 });
    // Defense: native layers sometimes re-encode the deep link, so the code can
    // arrive percent-encoded (4%2F0A…). Real Google codes never contain '%'.
    if (google_code && google_code.includes('%')) {
      try { google_code = decodeURIComponent(google_code); } catch { /* keep as-is */ }
    }

    const secret = Deno.env.get('JWT_SECRET');
    const payload = await verifyJwt(token, secret);
    if (!payload) return Response.json({ error: 'Invalid or expired session' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const account = await base44.asServiceRole.entities.Account.get(payload.sub);
    if (!account) return Response.json({ error: 'Account not found' }, { status: 401 });
    if (!account.is_anonymous) {
      return Response.json({ error: 'This account already has a login' }, { status: 400 });
    }

    let updates;

    if (google_code) {
      // ── Link with Google (authorization code flow) ────────────────────────
      // Exchange the single-use code server-side; identity comes from the
      // id_token, which arrives directly from Google over TLS (trusted as-is).
      const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || req.headers.get('origin') || 'https://despia-connect-go.base44.app';
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
      let payloadB64 = tokenData.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payloadB64.length % 4) payloadB64 += '=';
      const tokenInfo = JSON.parse(atob(payloadB64));
      if (!tokenInfo.email) return Response.json({ error: 'Google account has no email' }, { status: 401 });
      if (tokenInfo.aud !== Deno.env.get('GOOGLE_CLIENT_ID')) {
        return Response.json({ error: 'Token not issued for this app' }, { status: 401 });
      }

      const cleanEmail = tokenInfo.email.toLowerCase().trim();
      const existing = await base44.asServiceRole.entities.Account.filter({ email: cleanEmail });
      if (existing?.length && existing[0].id !== account.id) {
        // The Google email already belongs to a registered account, and Google has
        // proven ownership — MERGE: move the device binding onto the existing
        // account (so future device sign-ins resolve to it), delete the anonymous
        // account, and sign the user into the existing one.
        const target = existing[0];
        await base44.asServiceRole.entities.Account.update(target.id, {
          device_id: account.device_id || target.device_id || '',
          google_id: target.google_id || tokenInfo.sub || '',
          avatar_url: target.avatar_url || tokenInfo.picture || '',
          email_verified: true,
          last_login_at: new Date().toISOString(),
        });
        // NOTE: if app entities ever reference the account id, re-point the
        // anonymous account's records to target.id here before deleting.
        await base44.asServiceRole.entities.Account.delete(account.id);

        const mergedToken = await signJwt({ sub: target.id, email: target.email, role: target.role }, secret);
        return Response.json({
          token: mergedToken,
          account: {
            id: target.id,
            email: target.email,
            full_name: target.full_name,
            role: target.role,
            avatar_url: target.avatar_url || tokenInfo.picture || null,
            email_verified: true,
            is_anonymous: false,
          },
        });
      }

      updates = {
        email: cleanEmail,
        google_id: tokenInfo.sub || '',
        avatar_url: account.avatar_url || tokenInfo.picture || '',
        full_name: account.full_name && account.full_name !== 'Guest' ? account.full_name : (tokenInfo.name || cleanEmail.split('@')[0]),
        email_verified: true,
        is_anonymous: false,
        last_login_at: new Date().toISOString(),
      };
    } else {
      // ── Link with email + password ────────────────────────────────────────
      if (!email || !password) return Response.json({ error: 'Email and password are required' }, { status: 400 });
      if (password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

      const cleanEmail = email.toLowerCase().trim();
      const existing = await base44.asServiceRole.entities.Account.filter({ email: cleanEmail });
      if (existing?.length && existing[0].id !== account.id) {
        return Response.json({ error: 'An account with this email already exists' }, { status: 409 });
      }

      updates = {
        email: cleanEmail,
        password_hash: await hashPassword(password),
        full_name: full_name || (account.full_name !== 'Guest' ? account.full_name : cleanEmail.split('@')[0]),
        email_verified: false,
        is_anonymous: false,
        last_login_at: new Date().toISOString(),
      };
    }

    await base44.asServiceRole.entities.Account.update(account.id, updates);
    const newToken = await signJwt({ sub: account.id, email: updates.email, role: account.role }, secret);

    return Response.json({
      token: newToken,
      account: {
        id: account.id,
        email: updates.email,
        full_name: updates.full_name,
        role: account.role,
        avatar_url: updates.avatar_url || account.avatar_url || null,
        email_verified: updates.email_verified,
        is_anonymous: false,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});