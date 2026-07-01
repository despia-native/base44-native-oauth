// Client helpers for the admin-only user management screen.
import { base44 } from '@/api/base44Client';
import { getToken } from '@/lib/customAuth';

async function invoke(action, extra = {}) {
  const token = getToken();
  const res = await base44.functions.invoke('adminUsers', { token, action, ...extra });
  return res.data;
}

export async function listAccounts() {
  const data = await invoke('list');
  return data.accounts;
}

export async function setAccountRole(target_id, role) {
  return invoke('update_role', { target_id, updates: { role } });
}

export async function deleteAccount(target_id) {
  return invoke('delete', { target_id });
}