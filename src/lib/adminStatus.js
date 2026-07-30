// Determines whether an administrator account already exists, without ever
// exposing the admin's row data to an unauthenticated caller. Backed by the
// has_admin() Postgres function (see supabase/schema.sql), which is
// SECURITY DEFINER and only ever returns a boolean.

import { sb } from './supabaseClient.js';

export async function hasAdmin() {
  const { data, error } = await sb.rpc('has_admin');

  if (error) {
    console.error('Could not determine admin status:', error.message);
    // Fail safe: if the check itself is broken, assume an admin exists so
    // we never accidentally expose the setup/registration page publicly.
    return true;
  }

  return data === true;
}
