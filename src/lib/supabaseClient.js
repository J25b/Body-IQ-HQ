// Single shared Supabase client instance for the whole app.
// Every page/component should import `sb` from here rather than creating
// its own client, so there is exactly one source of truth for the session.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// window.supabase is the global exposed by the CDN <script> tag in index.html.
// We name our instance `sb` (not `supabase`) to avoid shadowing that global.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false // we use hash routing ourselves; avoid conflicts
  }
});
