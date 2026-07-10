// Send push notifications via OneSignal (device registration is handled by Despia).
// Targets: 'self' (any logged-in user — test pushes), 'user' (admin → one user),
// 'users' (admin → several users), 'tag' (admin → tag-based segment),
// 'all' (admin → every subscribed device). Devices are linked to Account ids via
// setonesignalplayerid:// on the client, so we target with include_external_user_ids.
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

    // OneSignal credentials — from the ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY
    // secrets (dashboard → settings → environment variables).
    // Both come from OneSignal → Settings → Keys & IDs.
    const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID') || '';
    const oneSignalRestKey = Deno.env.get('ONESIGNAL_REST_API_KEY') || '';

    const body = await req.json();
    const {
      token, target = 'self', user_id, user_ids, tag,
      title, message, path, url, metadata,
      send_after, delivery_time_of_day, badge,
    } = body;
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!title || !message) return Response.json({ error: 'Missing title or message' }, { status: 400 });
    if (!oneSignalAppId || !oneSignalRestKey) {
      return Response.json({ error: 'OneSignal is not configured yet — add your App ID and REST API Key.' }, { status: 500 });
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

    // Only admins may push to other users or broadcast to everyone.
    if (target !== 'self' && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const notification = {
      app_id: oneSignalAppId,
      headings: { en: title },
      contents: { en: message },
    };

    // Deep linking (Despia): path → History API navigation on tap (no reload),
    // url → full WebView reload, metadata → delivered to window.onNotificationEvent.
    const data = {};
    if (path) data.path = path;
    if (url) data.url = url;
    if (metadata !== undefined) data.metadata = metadata;
    if (Object.keys(data).length) notification.data = data;

    // Scheduling: send_after = absolute UTC time; delivery_time_of_day = each
    // user's local time (e.g. "9:00AM").
    if (send_after) notification.send_after = send_after;
    if (delivery_time_of_day) {
      notification.delayed_option = 'timezone';
      notification.delivery_time_of_day = delivery_time_of_day;
    }

    // iOS badge: { type: 'Increase' | 'SetTo' | 'None', count }.
    if (badge) {
      notification.ios_badgeType = badge.type || 'Increase';
      notification.ios_badgeCount = badge.count ?? 1;
    }

    if (target === 'all') {
      notification.included_segments = ['Subscribed Users'];
    } else if (target === 'user') {
      if (!user_id) return Response.json({ error: 'Missing user_id' }, { status: 400 });
      notification.include_external_user_ids = [user_id];
    } else if (target === 'users') {
      if (!Array.isArray(user_ids) || !user_ids.length) return Response.json({ error: 'Missing user_ids' }, { status: 400 });
      notification.include_external_user_ids = user_ids;
    } else if (target === 'tag') {
      if (!tag?.key) return Response.json({ error: 'Missing tag key' }, { status: 400 });
      notification.filters = [{ field: 'tag', key: tag.key, relation: tag.relation || '=', value: String(tag.value ?? '') }];
    } else {
      notification.include_external_user_ids = [caller.id];
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${oneSignalRestKey}` },
      body: JSON.stringify(notification),
    });
    const result = await res.json();

    if (!res.ok || result.errors) {
      const detail = Array.isArray(result.errors) ? result.errors.join(', ') : JSON.stringify(result.errors || result);
      return Response.json({ error: `OneSignal: ${detail}` }, { status: 502 });
    }

    return Response.json({ success: true, notification_id: result.id, recipients: result.recipients ?? 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});