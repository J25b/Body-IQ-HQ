// Phase Eight: Security. Five cards: login activity (from the
// SECURITY DEFINER get_login_activity function, never raw table access),
// session controls, a description of the failed-login lockout policy,
// an honest "not built yet" card for 2FA, and an environment sanity check.

import { renderAppShell } from '../components/appShell.js';
import { loadingStateHTML } from '../components/loadingState.js';
import { emptyStateHTML } from '../components/emptyState.js';
import { sb } from '../lib/supabaseClient.js';
import { signOut } from '../lib/authGuard.js';
import { navigate } from '../router.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' \u00b7 ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function maskKey(key) {
  if (!key || key.length < 10) return key ? '\u2022\u2022\u2022\u2022\u2022\u2022' : '\u2014 not set';
  return key.slice(0, 6) + '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + key.slice(-4);
}

export async function renderSecurity(container) {
  const main = await renderAppShell(container, { title: 'Security' });
  if (!main) return;

  main.innerHTML = loadingStateHTML('Loading security information\u2026');

  let activity = [];
  try {
    const { data, error } = await sb.rpc('get_login_activity', { p_limit: 25 });
    if (error) throw error;
    activity = data || [];
  } catch (err) {
    console.error('Could not load login activity:', err.message);
  }

  const activityHTML = activity.length
    ? '<div class="content-table">' + activity.map(function (row) {
        const badge = row.success
          ? '<span class="status-badge badge-published">success</span>'
          : '<span class="status-badge badge-disabled">failed</span>';
        return `
          <div class="content-row">
            <div class="content-row-main">
              <div class="content-row-title">${escapeHtml(row.email)}</div>
              <div class="content-row-body">${escapeHtml(row.user_agent || 'Unknown device')}</div>
            </div>
            <div class="content-row-meta">${badge}</div>
            <div class="content-row-actions"><span class="activity-time">${formatDateTime(row.created_at)}</span></div>
          </div>
        `;
      }).join('') + '</div>'
    : emptyStateHTML({ iconName: 'security', title: 'No login activity yet', message: 'Successful and failed sign-in attempts will show up here.' });

  main.innerHTML = `
    <div class="settings-grid">
      <section class="settings-card settings-card-wide">
        <h3 class="settings-card-title">Login Activity</h3>
        <p class="settings-card-subtitle">Your most recent sign-in attempts, successful and failed.</p>
        ${activityHTML}
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Session</h3>
        <p class="settings-card-subtitle">
          You're automatically signed out after 20 minutes of inactivity \u2014
          this is separate from, and shorter than, your underlying session's own expiry.
        </p>
        <button type="button" class="btn-secondary" id="signout-everywhere-btn">Sign out everywhere</button>
        <p class="form-hint" style="margin-top:8px;">Ends this session and any others (e.g. a different browser) at once.</p>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Failed Login Protection</h3>
        <p class="settings-card-subtitle">
          After 5 failed attempts for the same email within 15 minutes, further attempts
          are temporarily blocked until the window passes \u2014 enforced in the database,
          not just in this page.
        </p>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Two-Factor Authentication</h3>
        <p class="settings-card-subtitle">
          Not available yet. Supabase Auth supports TOTP-based 2FA natively, and the login
          flow already has a hook prepared for it (see the comment in <code>login.js</code>) \u2014
          it just isn't built out with enrollment UI yet.
        </p>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Environment</h3>
        <p class="settings-card-subtitle">Confirms your build-time configuration is present, without exposing it.</p>
        <div class="env-row"><span>Supabase URL</span><span class="env-value">${escapeHtml(SUPABASE_URL || '\u2014 not set')}</span></div>
        <div class="env-row"><span>Supabase anon key</span><span class="env-value">${escapeHtml(maskKey(SUPABASE_ANON_KEY))}</span></div>
      </section>
    </div>
  `;

  main.querySelector('#signout-everywhere-btn').addEventListener('click', async function () {
    const btn = main.querySelector('#signout-everywhere-btn');
    btn.disabled = true;
    btn.textContent = 'Signing out\u2026';
    try {
      await sb.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error('Global sign-out failed, falling back to local sign-out:', err.message);
      await signOut();
    }
    navigate('/login');
  });
}
