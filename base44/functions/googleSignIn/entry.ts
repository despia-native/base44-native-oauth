// base44/functions/googleSignIn/entry.ts
//
// NATIVE GOOGLE OAUTH — Full Backend Token Exchange
//
// Mental model:
//   1. Frontend (Despia) gets a Google access token via the implicit OAuth flow
//   2. Sends it here — we NEVER trust it blindly
//   3. We verify it with Google's own tokeninfo API (server-side, no secret needed)
//   4. Google confirms: yes this is a valid token, here is the user's email
//   5. We look that email up in Base44's User table
//   6. If not found → create the user via inviteUser, then re-fetch
//   7. We issue a real Base44 JWT for that user via sso.getAccessToken
//   8. Return the Base44 token to the frontend
//   9. Frontend calls base44.auth.setToken(base44Token) → fully authenticated
//
// This completely bypasses the redirect-based OAuth flow for native apps,
// while remaining secure because we always verify the token with Google first.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, content-type'
        }
      });
    }

    const { google_token } = await req.json();

    if (!google_token) {
      return Response.json({ error: 'google_token is required' }, { status: 400 });
    }

    // ── Step 1: Verify the Google token with Google's tokeninfo endpoint ──────
    // This is the critical security step. We ask Google: "is this token valid?"
    // Google returns the user's email, sub (Google user ID), and expiry.
    // If the token is fake/expired/tampered with, Google returns an error.
    const tokenInfoRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${google_token}`
    );

    if (!tokenInfoRes.ok) {
      return Response.json({ error: 'Invalid Google token — verification failed' }, { status: 401 });
    }

    const tokenInfo = await tokenInfoRes.json();

    // Confirm the token has the email scope and is not expired
    if (!tokenInfo.email) {
      return Response.json({ error: 'Google token does not include email scope' }, { status: 401 });
    }

    if (tokenInfo.error_description) {
      return Response.json({ error: tokenInfo.error_description }, { status: 401 });
    }

    const googleEmail = tokenInfo.email.toLowerCase().trim();

    // ── Step 2: Look up the user by email in Base44 ───────────────────────────
    const base44 = createClientFromRequest(req);

    let users = await base44.asServiceRole.entities.User.filter({ email: googleEmail });
    let user = users?.[0];

    // ── Step 3: If user doesn't exist, create them ────────────────────────────
    // inviteUser registers the email in Base44's user system without sending an invite email
    // in the context of a service-role backend call.
    if (!user) {
      await base44.users.inviteUser(googleEmail, 'user');
      // Re-fetch to get the newly created user record with their ID
      const newUsers = await base44.asServiceRole.entities.User.filter({ email: googleEmail });
      user = newUsers?.[0];
    }

    if (!user) {
      return Response.json({ error: 'Failed to find or create user' }, { status: 500 });
    }

    // ── Step 4: Issue a real Base44 auth token for this user ──────────────────
    // sso.getAccessToken returns a Base44 JWT — same as what loginWithProvider gives you.
    // The frontend can call base44.auth.setToken(access_token) with this.
    const { access_token } = await base44.asServiceRole.sso.getAccessToken(user.id);

    return Response.json({
      access_token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});