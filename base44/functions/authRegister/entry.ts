// Custom auth — email/password registration.
// Creates an Account (our own user DB), returns our own signed JWT.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── JWT (HS256) — no external deps, uses Web Crypto ─────────────────────────
function b64url(bytes) {
  let str = typeof bytes === 'string' ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function signJwt(payload, secret, expiresInSec = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const enc = new TextEncoder();
  const headerB64 = b64url(JSON.stringify(header));
  const bodyB64 = b64url(JSON.stringify(body));
  const data = `${headerB64}.${bodyB64}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

// ── Password hashing — PBKDF2 (Web Crypto), stored as salt:hash hex ─────────
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

    const { email, password, full_name } = await req.json();
    if (!email || !password) return Response.json({ error: 'Email and password are required' }, { status: 400 });
    if (password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

    const cleanEmail = email.toLowerCase().trim();
    const base44 = createClientFromRequest(req);

    const existing = await base44.asServiceRole.entities.Account.filter({ email: cleanEmail });
    if (existing?.length) return Response.json({ error: 'An account with this email already exists' }, { status: 409 });

    const password_hash = await hashPassword(password);
    const account = await base44.asServiceRole.entities.Account.create({
      email: cleanEmail,
      full_name: full_name || cleanEmail.split('@')[0],
      password_hash,
      email_verified: false,
      role: 'user',
      last_login_at: new Date().toISOString(),
    });

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