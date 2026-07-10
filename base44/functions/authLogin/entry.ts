// Custom auth — email/password login.
// Verifies password against the Account, returns our own signed JWT.
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

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Constant-time string compare — avoids leaking hash-match info via timing.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return timingSafeEqual(toHex(bits), hashHex);
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { email, password } = await req.json();
    if (!email || !password) return Response.json({ error: 'Email and password are required' }, { status: 400 });

    const cleanEmail = email.toLowerCase().trim();
    const base44 = createClientFromRequest(req);

    const accounts = await base44.asServiceRole.entities.Account.filter({ email: cleanEmail });
    const account = accounts?.[0];
    // Generic message — don't reveal whether the email exists
    if (!account || !(await verifyPassword(password, account.password_hash))) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await base44.asServiceRole.entities.Account.update(account.id, { last_login_at: new Date().toISOString() });

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