// Session helpers shared by every protected page.

import { sb } from './supabaseClient.js';

export async function getSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) {
    console.error('Session check failed:', error.message);
    return null;
  }
  return data.session;
}

// Subscribe to auth state changes (login, logout, token refresh, expiry).
// Returns the subscription so callers can unsubscribe if needed.
export function onAuthChange(callback) {
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return data.subscription;
}

// Convenience guard for use at the top of any protected page's render
// function. Redirects (via the provided callback) if no session exists.
export async function requireSession(onNoSession) {
  const session = await getSession();
  if (!session) {
    onNoSession();
    return null;
  }
  return session;
}

export async function signOut() {
  await sb.auth.signOut();
}

// ---- Inactivity timeout ----
// Client-driven, separate from Supabase's own token expiry — this signs
// the admin out after a period of no mouse/keyboard/touch activity,
// regardless of how long the underlying auth token would otherwise
// remain valid. renderAppShell() restarts this on every page render, so
// navigating around the console keeps it alive; only true idle time
// triggers it.

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

let inactivityTimer = null;
let inactivityHandlerRef = null;

export function startInactivityWatcher(onTimeout) {
  stopInactivityWatcher();

  function resetTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async function () {
      try { sessionStorage.setItem('bodyiqHqInactivityLogout', 'true'); } catch (e) {}
      await signOut();
      onTimeout();
    }, INACTIVITY_TIMEOUT_MS);
  }

  inactivityHandlerRef = resetTimer;
  ACTIVITY_EVENTS.forEach(function (evt) {
    document.addEventListener(evt, inactivityHandlerRef, { passive: true });
  });
  resetTimer();
}

export function stopInactivityWatcher() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (inactivityHandlerRef) {
    ACTIVITY_EVENTS.forEach(function (evt) {
      document.removeEventListener(evt, inactivityHandlerRef);
    });
  }
  inactivityTimer = null;
  inactivityHandlerRef = null;
}
