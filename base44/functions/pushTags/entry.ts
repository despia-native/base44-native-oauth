// Set OneSignal tags on a user (external_id = Account id) for tag-based push
// segments (sendPush target: 'tag'). Any user may tag themselves; only admins
// may tag other users.
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
  try {
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
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID') || '';
    const oneSignalRestKey = Deno.env.get('ONESIGNAL_REST_API_KEY') || '';
    if (!oneSignalAppId || !oneSignalRestKey) {
      return Response.json({ error: 'OneSignal is not configured yet — add your App ID and REST API Key.' }, { status: 500 });
    }

    const { token, tags, user_id } = await req.json();
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!tags || typeof tags !== 'object' || !Object.keys(tags).length) {
      return Response.json({ error: 'Missing tags' }, { status: 400 });
    }

    const secret = Deno.env.get('JWT_SECRET');
    if (!secret || secret.length < 32) {
      return Response.json({ error: 'Server auth is not configured' }, { status: 500 });
    }
    const payload = await verifyJwt(token, secret);
    if (!payload?.sub) return Response.json({ error: 'Invalid session' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const callers = await base44.asServiceRole.entities.Account.filter({ id: payload.sub });
    const caller = callers?.[0];
    if (!caller) return Response.json({ error: 'Account not found' }, { status: 401 });

    // Only admins may tag other users.
    const targetId = user_id || caller.id;
    if (targetId !== caller.id && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const res = await fetch(`https://onesignal.com/api/v1/apps/${oneSignalAppId}/users/${encodeURIComponent(targetId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${oneSignalRestKey}` },
      body: JSON.stringify({ tags }),
    });
    const result = await res.json();

    if (!res.ok || result.errors) {
      const detail = Array.isArray(result.errors) ? result.errors.join(', ') : JSON.stringify(result.errors || result);
      return Response.json({ error: `OneSignal: ${detail}` }, { status: 502 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});