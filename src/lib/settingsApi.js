// Thin key/value wrapper around the app_settings table.

import { sb } from './supabaseClient.js';

export async function getSetting(key) {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

export async function setSetting(key, value) {
  const { error } = await sb.from('app_settings').upsert({ key: key, value: value });
  if (error) throw error;
}
