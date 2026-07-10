// Custom auth — reset password using a signed reset token.
// Verifies the reset JWT, checks it's still bound to the current hash, then sets the new password.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(str) {
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
  const sig = Uint8Array.from(b64urlDecode(sigB64), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(`${headerB64}.${bodyB64}`));
  if (!valid) return null;
  const payload = JSON.parse(b64urlDecode(bodyB64));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

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

    const { reset_token, new_password } = await req.json();
    if (!reset_token || !new_password) return Response.json({ error: 'Reset token and new password are required' }, { status: 400 });
    if (new_password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

    const secret = Deno.env.get('JWT_SECRET');
    if (!secret || secret.length < 32) {
      return Response.json({ error: 'Server auth is not configured' }, { status: 500 });
    }
    const payload = await verifyJwt(reset_token, secret);
    if (!payload || payload.purpose !== 'password_reset') {
      return Response.json({ error: 'This reset link is invalid or has expired' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const account = await base44.asServiceRole.entities.Account.get(payload.sub);
    if (!account) return Response.json({ error: 'This reset link is invalid or has expired' }, { status: 401 });

    // Link is single-use: it was bound to the hash at issue time; if the password already changed, reject.
    if (!account.password_hash || account.password_hash.slice(0, 16) !== payload.ph) {
      return Response.json({ error: 'This reset link has already been used or has expired' }, { status: 401 });
    }

    const password_hash = await hashPassword(new_password);
    await base44.asServiceRole.entities.Account.update(account.id, { password_hash });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});