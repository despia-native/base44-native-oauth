// Persist the session JWT in the Despia Storage Vault (native only).
// The vault survives app restarts, updates, and uninstall/reinstall — and syncs
// across devices on the same Apple ID / Google account — so the user's session
// (including a linked account) is restored even after reinstalling the app.
import despia from 'despia-native';

const VAULT_TOKEN_KEY = 'app_session_token';

const isNative = () =>
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('despia');

export async function saveVaultToken(token) {
  if (!isNative() || !token) return;
  try {
    await despia(`setvault://?key=${VAULT_TOKEN_KEY}&value=${encodeURIComponent(token)}&locked=false`);
  } catch {
    // Vault unavailable — session still works via localStorage.
  }
}

export async function readVaultToken() {
  if (!isNative()) return null;
  try {
    const data = await despia(`readvault://?key=${VAULT_TOKEN_KEY}`, [VAULT_TOKEN_KEY]);
    const value = data?.[VAULT_TOKEN_KEY];
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null; // key not found — no persisted session
  }
}

export async function clearVaultToken() {
  if (!isNative()) return;
  try {
    // No delete command — overwrite with an empty value.
    await despia(`setvault://?key=${VAULT_TOKEN_KEY}&value=&locked=false`);
  } catch {
    // ignore
  }
}