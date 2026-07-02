// Custom auth — verify our JWT and return the current account.
// The frontend sends the token as Authorization: Bearer <token> OR in the body.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    let token = null;
    const authHeader = req.headers.get('x-app-token');
    if (authHeader) token = authHeader;
    if (!token) {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }
    if (!token) return Response.json({ error: 'No token provided' }, { status: 401 });

    const secret = Deno.env.get('JWT_SECRET');
    const payload = await verifyJwt(token, secret);
    if (!payload) return Response.json({ error: 'Invalid or expired token' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const account = await base44.asServiceRole.entities.Account.get(payload.sub);
    if (!account) return Response.json({ error: 'Account not found' }, { status: 401 });

    return Response.json({
      account: {
        id: account.id,
        email: account.email,
        full_name: account.full_name,
        role: account.role,
        avatar_url: account.avatar_url || null,
        email_verified: account.email_verified || false,
        is_anonymous: account.is_anonymous || false,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});