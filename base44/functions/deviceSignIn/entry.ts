// Loginless / anonymous auth for native (Despia) app runs.
// Takes a stable device UUID (from the Storage Vault) and finds-or-creates an
// anonymous Account for it, then returns OUR own signed JWT — same session shape
// as email/password and Google sign-in.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64url(bytes) {
  const str = typeof bytes === 'string' ? bytes : String.fromCharCode(...new Uint8Array(bytes));
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

// Basic sanity check on the device id — must look like a UUID / opaque token, not arbitrary junk.
function isValidDeviceId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9._-]{8,128}$/.test(id);
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { device_id } = await req.json();
    if (!isValidDeviceId(device_id)) {
      return Response.json({ error: 'A valid device_id is required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // The device id IS the identity. Synthetic email keeps the unique-email model intact.
    const email = `device-${device_id.toLowerCase()}@anon.local`;

    let accounts = await base44.asServiceRole.entities.Account.filter({ device_id });
    let account = accounts?.[0];

    if (!account) {
      account = await base44.asServiceRole.entities.Account.create({
        email,
        full_name: 'Guest',
        device_id,
        is_anonymous: true,
        email_verified: false,
        role: 'user',
        last_login_at: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.Account.update(account.id, {
        last_login_at: new Date().toISOString(),
      });
    }

    const secret = Deno.env.get('JWT_SECRET');
    const token = await signJwt({ sub: account.id, email: account.email, role: account.role }, secret);

    return Response.json({
      token,
      account: {
        id: account.id,
        email: account.email,
        full_name: account.full_name,
        role: account.role,
        // The device may have since been linked to a real login — report the truth.
        is_anonymous: account.is_anonymous !== false,
        avatar_url: account.avatar_url || null,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});