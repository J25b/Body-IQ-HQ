// App entry point. Boot sequence:
//   1. Does an administrator exist at all? If not -> force /setup.
//   2. If one exists, is there a valid session? Route to /dashboard or
//      /login accordingly.
//   3. Start the hash router and keep listening for auth state changes
//      (e.g. an expired token) so a signed-out session anywhere redirects
//      to /login immediately, not just on next navigation.

import { registerRoute, startRouter, setDefaultRoute, currentPath } from './router.js';
import { hasAdmin } from './lib/adminStatus.js';
import { getSession, onAuthChange } from './lib/authGuard.js';
import { renderSetup } from './pages/setup.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderAnalytics } from './pages/analytics.js';
import { renderContent } from './pages/content.js';
import { renderInsights } from './pages/insights.js';
import { renderSettings } from './pages/settings.js';
import { renderSecurity } from './pages/security.js';
import { renderHealth } from './pages/health.js';

registerRoute('/setup', renderSetup);
registerRoute('/login', renderLogin);
registerRoute('/dashboard', renderDashboard);
registerRoute('/analytics', renderAnalytics);
registerRoute('/content', renderContent);
registerRoute('/insights', renderInsights);
registerRoute('/settings', renderSettings);
registerRoute('/security', renderSecurity);
registerRoute('/health', renderHealth);

async function boot() {
  const adminExists = await hasAdmin();

  if (!adminExists) {
    setDefaultRoute('/setup');
    if (currentPath() !== '/setup') {
      window.location.hash = '/setup';
    }
    startRouter();
    return;
  }

  setDefaultRoute('/login');

  const session = await getSession();
  const path = currentPath();

  if (session && (path === '/login' || path === '/setup')) {
    window.location.hash = '/dashboard';
  } else if (!session && path !== '/login') {
    window.location.hash = '/login';
  }

  startRouter();

  // If the session ends anywhere (logout elsewhere, token expiry, etc.),
  // bounce to the login page immediately rather than on next navigation.
  onAuthChange((session) => {
    const path = currentPath();
    if (!session && path !== '/login') {
      window.location.hash = '/login';
    }
  });
}

boot().catch(function (err) {
  console.error('BodyIQ HQ failed to start:', err);
  const app = document.getElementById('app');
  app.innerHTML =
    '<div class="boot-fallback">' +
      '<p>BodyIQ HQ couldn\u2019t start.</p>' +
      '<p class="boot-fallback-hint">' +
        (window.supabase
          ? 'There was a problem reaching Supabase. Check your connection, that src/config.js has real (not placeholder) credentials, and that your Supabase project is online, then reload this page.'
          : 'The Supabase client library didn\u2019t load \u2014 check your internet connection and that nothing (like a browser extension or content blocker) is blocking cdn.jsdelivr.net, then reload this page.') +
      '</p>' +
    '</div>';
});
