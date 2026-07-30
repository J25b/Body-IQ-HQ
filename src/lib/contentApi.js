// CRUD layer for content_items. Pages call these instead of touching `sb`
// directly, so the query shape lives in exactly one place.

import { sb } from './supabaseClient.js';

export async function listContentByType(type) {
  const { data, error } = await sb
    .from('content_items')
    .select('*')
    .eq('type', type)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createContentItem(item) {
  const { data, error } = await sb.from('content_items').insert(item).select().single();
  if (error) throw error;
  return data;
}

export async function updateContentItem(id, patch) {
  const { data, error } = await sb.from('content_items').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteContentItem(id) {
  const { error } = await sb.from('content_items').delete().eq('id', id);
  if (error) throw error;
}
