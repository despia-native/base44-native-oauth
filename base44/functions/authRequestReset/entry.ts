// Custom auth — request a password reset.
// Signs a short-lived reset JWT and emails a link. Always returns success (don't reveal if the email exists).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64url(bytes) {
  let str = typeof bytes === 'string' ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function signJwt(payload, secret, expiresInSec) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const enc = new TextEncoder();
  const data = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(body))}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { email } = await req.json();
    if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });

    const cleanEmail = email.toLowerCase().trim();
    const base44 = createClientFromRequest(req);

    const accounts = await base44.asServiceRole.entities.Account.filter({ email: cleanEmail });
    const account = accounts?.[0];

    // Only send if the account exists AND has a password (Google-only accounts skip this),
    // but always return the same generic response.
    if (account && account.password_hash) {
      const secret = Deno.env.get('JWT_SECRET');
      if (!secret || secret.length < 32) {
        return Response.json({ error: 'Server auth is not configured' }, { status: 500 });
      }
      // scope the token to password reset + bind to current hash so used/old links stop working after reset
      const resetToken = await signJwt(
        { sub: account.id, email: account.email, purpose: 'password_reset', ph: account.password_hash.slice(0, 16) },
        secret,
        60 * 30, // 30 minutes
      );

      // Security: never use a client-supplied URL for the email link (open redirect →
      // reset-token theft). The link base is always server-controlled: the APP_BASE_URL
      // secret when set (e.g. a custom domain), otherwise the app's own domain.
      const base = (Deno.env.get('APP_BASE_URL') || 'https://despia-connect-go.base44.app').replace(/\/$/, '');
      const link = `${base}/reset-password?token=${encodeURIComponent(resetToken)}`;

      // Send via Resend so we can reach any email (not just registered Base44 users).
      const resendKey = Deno.env.get('RESEND_API_KEY');
      // Escape the user-controlled name so a malicious full_name can't inject HTML into the email.
      const safeName = String(account.full_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const html = `<p>Hi ${safeName},</p>
<p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 30 minutes.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Reset password</a></p>
<p>Or paste this link into your browser:<br>${link}</p>
<p>If you didn't request this, you can safely ignore this email.</p>`;

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ⚠️ 'onboarding@resend.dev' is Resend's SANDBOX sender — it only delivers to your own
          // account email and is NOT for production. Set the RESEND_FROM secret to an address on a
          // domain you've verified in Resend (e.g. 'noreply@yourdomain.com') before going live.
          from: Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev',
          to: account.email,
          subject: 'Reset your password',
          html,
        }),
      });
      if (!resp.ok) {
        console.error('Resend error:', resp.status, await resp.text());
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});