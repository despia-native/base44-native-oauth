// Admin-only user management for our custom auth system.
// Verifies the caller's JWT + admin role, then lists / updates / deletes Account records.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, b64urlToBytes(s), enc.encode(`${h}.${p}`));
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const body = await req.json();
    const { token, action, target_id, updates } = body;
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const secret = Deno.env.get('JWT_SECRET');
    const payload = await verifyJwt(token, secret);
    if (!payload?.sub) return Response.json({ error: 'Invalid session' }, { status: 401 });

    const base44 = createClientFromRequest(req);

    // Confirm the caller is an admin (re-read from DB, never trust the token's role claim).
    const caller = await base44.asServiceRole.entities.Account.filter({ id: payload.sub });
    if (!caller?.[0] || caller[0].role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'list') {
      const accounts = await base44.asServiceRole.entities.Account.list('-created_date', 500);
      const safe = accounts.map((a) => ({
        id: a.id,
        email: a.email,
        full_name: a.full_name,
        avatar_url: a.avatar_url,
        role: a.role,
        email_verified: a.email_verified,
        last_login_at: a.last_login_at,
        created_date: a.created_date,
      }));
      return Response.json({ accounts: safe });
    }

    if (action === 'update_role') {
      if (!target_id || !updates?.role) return Response.json({ error: 'Missing target_id or role' }, { status: 400 });
      if (!['user', 'admin'].includes(updates.role)) return Response.json({ error: 'Invalid role' }, { status: 400 });
      await base44.asServiceRole.entities.Account.update(target_id, { role: updates.role });
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      if (!target_id) return Response.json({ error: 'Missing target_id' }, { status: 400 });
      if (target_id === payload.sub) return Response.json({ error: 'You cannot delete your own account' }, { status: 400 });
      await base44.asServiceRole.entities.Account.delete(target_id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});