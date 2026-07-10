// Custom auth — delete the current account (Apple 5.1.1(v) / Google Play compliant).
//
// TWO DELETION MODES — see ACCOUNT_DELETION.md for the full rationale:
//
//  • ANONYMIZE (account has a device_id — it is/was a native device account):
//    All personal data is wiped (email, name, password, Google/Apple identity,
//    avatar) and the record reverts to the anonymous guest account for that
//    device — "linked" becomes "unlinked". The record ID is KEPT on purpose:
//    RevenueCat entitlements are keyed to this account id (external_id), so
//    deleting the row would orphan the user's in-app purchases. Keeping the
//    anonymous shell preserves IAP access while removing every piece of PII,
//    which is what the store rules actually require ("delete the account and
//    associated personal data").
//
//  • HARD DELETE (no device_id — web-only account, never bound to a device):
//    The record is removed entirely. There is no device/IAP identity to keep.
//
// The user confirms in-app (biometrics via locked Storage Vault, or password /
// type-DELETE) before the frontend calls this. Token via x-app-token or body.
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

    let token = req.headers.get('x-app-token');
    if (!token) {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }
    if (!token) return Response.json({ error: 'No token provided' }, { status: 401 });

    const secret = Deno.env.get('JWT_SECRET');
    if (!secret || secret.length < 32) {
      return Response.json({ error: 'Server auth is not configured' }, { status: 500 });
    }
    const payload = await verifyJwt(token, secret);
    if (!payload) return Response.json({ error: 'Invalid or expired token' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const account = await base44.asServiceRole.entities.Account.get(payload.sub).catch(() => null);
    // Idempotent: already-deleted accounts also return success.
    if (!account) return Response.json({ success: true, mode: 'already_deleted' });

    // ── 1. Wipe ALL app data owned by this account ─────────────────────────
    // IMPORTANT (compliance): every future entity that stores user data keyed
    // to the account MUST be wiped here, e.g.:
    //   await base44.asServiceRole.entities.Task.deleteMany({ account_id: account.id });

    // ── 2. Remove the account identity ─────────────────────────────────────
    if (account.device_id) {
      // Device-bound: anonymize back to the guest account (linked → unlinked).
      // Same record id ⇒ RevenueCat external_id unchanged ⇒ IAPs stay valid.
      await base44.asServiceRole.entities.Account.update(account.id, {
        email: `device-${account.device_id.toLowerCase()}@anon.local`,
        full_name: 'Guest',
        password_hash: '',
        google_id: '',
        apple_id: '',
        avatar_url: '',
        email_verified: false,
        is_anonymous: true,
        role: 'user',
      });
      return Response.json({ success: true, mode: 'anonymized' });
    }

    // Web-only account: nothing device-bound to preserve — remove entirely.
    await base44.asServiceRole.entities.Account.delete(account.id);
    return Response.json({ success: true, mode: 'deleted' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});