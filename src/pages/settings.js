// Phase Seven: Settings. Four independent cards — Profile, Password,
// Application Settings (maintenance mode + version), and Feature Flags.
// Each saves independently; there's no single giant "Save all" button,
// so a mistake in one section never risks the others.

import { renderAppShell } from '../components/appShell.js';
import { loadingStateHTML } from '../components/loadingState.js';
import { sb } from '../lib/supabaseClient.js';
import { getSession } from '../lib/authGuard.js';
import { getSetting, setSetting } from '../lib/settingsApi.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export async function renderSettings(container) {
  const main = await renderAppShell(container, { title: 'Settings' });
  if (!main) return;

  main.innerHTML = loadingStateHTML('Loading settings\u2026');

  const session = await getSession();
  const { data: adminRow } = await sb
    .from('admins').select('full_name, email').eq('id', session.user.id).single();

  let maintenanceMode = false;
  let appVersion = '';
  let featureFlags = {};
  try {
    maintenanceMode = (await getSetting('maintenance_mode')) === true;
    appVersion = (await getSetting('app_version')) || '';
    featureFlags = (await getSetting('feature_flags')) || {};
  } catch (err) {
    console.error('Could not load settings:', err.message);
  }

  main.innerHTML = `
    <div class="settings-grid">
      <section class="settings-card">
        <h3 class="settings-card-title">Profile</h3>
        <form id="profile-form" class="content-form">
          <label>Full name
            <input type="text" name="fullName" value="${escapeHtml(adminRow ? adminRow.full_name : '')}" required />
          </label>
          <label>Email
            <input type="email" name="email" value="${escapeHtml(adminRow ? adminRow.email : session.user.email)}" required />
          </label>
          <p class="form-hint">Changing your email requires confirming the new address before it takes effect.</p>
          <p class="form-error" id="profile-error" hidden></p>
          <p class="form-notice" id="profile-notice" hidden></p>
          <button type="submit" class="btn-primary">Save profile</button>
        </form>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Change Password</h3>
        <form id="password-form" class="content-form">
          <label>Current password
            <input type="password" name="currentPassword" required autocomplete="current-password" />
          </label>
          <label>New password
            <input type="password" name="newPassword" required minlength="8" autocomplete="new-password" />
          </label>
          <label>Confirm new password
            <input type="password" name="confirmPassword" required minlength="8" autocomplete="new-password" />
          </label>
          <p class="form-error" id="password-error" hidden></p>
          <p class="form-notice" id="password-notice" hidden></p>
          <button type="submit" class="btn-primary">Update password</button>
        </form>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Application Settings</h3>
        <form id="app-settings-form" class="content-form">
          <label class="settings-toggle-row">
            <span>
              Maintenance mode
              <span class="settings-toggle-hint">Shows a non-blocking notice on the public site when enabled \u2014 it doesn't lock anyone out.</span>
            </span>
            <span class="switch">
              <input type="checkbox" name="maintenanceMode" ${maintenanceMode ? 'checked' : ''} />
              <span class="switch-track"><span class="switch-thumb"></span></span>
            </span>
          </label>
          <label>App version
            <input type="text" name="appVersion" value="${escapeHtml(appVersion)}" placeholder="e.g. 1.5.0" />
          </label>
          <p class="form-error" id="app-settings-error" hidden></p>
          <p class="form-notice" id="app-settings-notice" hidden></p>
          <button type="submit" class="btn-primary">Save application settings</button>
        </form>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Feature Flags</h3>
        <p class="settings-card-subtitle">Not yet connected to any public-site behavior \u2014 these reserve a name and value ahead of wiring a real feature to one.</p>
        <div id="feature-flags-list"></div>
        <form id="add-flag-form" class="add-flag-form">
          <input type="text" name="flagName" placeholder="new-flag-name" required />
          <button type="submit" class="btn-secondary">+ Add flag</button>
        </form>
      </section>
    </div>
  `;

  wireProfileForm();
  wirePasswordForm();
  wireAppSettingsForm();
  wireFeatureFlags();

  function wireProfileForm() {
    const form = main.querySelector('#profile-form');
    const errorEl = main.querySelector('#profile-error');
    const noticeEl = main.querySelector('#profile-notice');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errorEl.hidden = true; noticeEl.hidden = true;
      const fd = new FormData(form);
      const fullName = fd.get('fullName').trim();
      const email = fd.get('email').trim();
      const submitBtn = form.querySelector('button[type=submit]');
      submitBtn.disabled = true;

      try {
        const { error: updateError } = await sb.from('admins').update({ full_name: fullName }).eq('id', session.user.id);
        if (updateError) throw updateError;

        if (email !== session.user.email) {
          const { error: authError } = await sb.auth.updateUser({ email: email });
          if (authError) throw authError;
          noticeEl.textContent = 'Profile saved. Check your new email address to confirm the change.';
        } else {
          noticeEl.textContent = 'Profile saved.';
        }
        noticeEl.hidden = false;
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function wirePasswordForm() {
    const form = main.querySelector('#password-form');
    const errorEl = main.querySelector('#password-error');
    const noticeEl = main.querySelector('#password-notice');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errorEl.hidden = true; noticeEl.hidden = true;
      const fd = new FormData(form);
      const currentPassword = fd.get('currentPassword');
      const newPassword = fd.get('newPassword');
      const confirmPassword = fd.get('confirmPassword');
      const submitBtn = form.querySelector('button[type=submit]');

      if (newPassword !== confirmPassword) {
        errorEl.textContent = 'New passwords do not match.';
        errorEl.hidden = false;
        return;
      }
      if (newPassword.length < 8) {
        errorEl.textContent = 'New password must be at least 8 characters.';
        errorEl.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating\u2026';

      try {
        // Re-verify the current password even though a valid session
        // already exists \u2014 a small extra guard against an unattended,
        // still-logged-in browser being used to hijack the account.
        const { error: verifyError } = await sb.auth.signInWithPassword({
          email: session.user.email,
          password: currentPassword
        });
        if (verifyError) throw new Error('Current password is incorrect.');

        const { error: updateError } = await sb.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;

        noticeEl.textContent = 'Password updated.';
        noticeEl.hidden = false;
        form.reset();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update password';
      }
    });
  }

  function wireAppSettingsForm() {
    const form = main.querySelector('#app-settings-form');
    const errorEl = main.querySelector('#app-settings-error');
    const noticeEl = main.querySelector('#app-settings-notice');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errorEl.hidden = true; noticeEl.hidden = true;
      const fd = new FormData(form);
      const newMaintenanceMode = fd.get('maintenanceMode') === 'on';
      const newAppVersion = (fd.get('appVersion') || '').trim();
      const submitBtn = form.querySelector('button[type=submit]');
      submitBtn.disabled = true;

      try {
        await setSetting('maintenance_mode', newMaintenanceMode);
        await setSetting('app_version', newAppVersion);
        noticeEl.textContent = 'Application settings saved.';
        noticeEl.hidden = false;
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function wireFeatureFlags() {
    function renderFlagsList() {
      const listEl = main.querySelector('#feature-flags-list');
      const keys = Object.keys(featureFlags);
      if (!keys.length) {
        listEl.innerHTML = '<p class="settings-empty-hint">No feature flags yet.</p>';
        return;
      }
      listEl.innerHTML = keys.map(function (key) {
        return `
          <div class="flag-row">
            <span class="flag-name">${escapeHtml(key)}</span>
            <span class="switch">
              <input type="checkbox" data-flag-toggle="${escapeHtml(key)}" ${featureFlags[key] ? 'checked' : ''} />
              <span class="switch-track"><span class="switch-thumb"></span></span>
            </span>
            <button type="button" class="btn-danger" data-flag-delete="${escapeHtml(key)}" aria-label="Delete flag">\u00d7</button>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('[data-flag-toggle]').forEach(function (input) {
        input.addEventListener('change', async function () {
          const key = input.getAttribute('data-flag-toggle');
          featureFlags[key] = input.checked;
          try { await setSetting('feature_flags', featureFlags); }
          catch (err) { alert('Could not save flag: ' + err.message); }
        });
      });
      listEl.querySelectorAll('[data-flag-delete]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const key = btn.getAttribute('data-flag-delete');
          delete featureFlags[key];
          try {
            await setSetting('feature_flags', featureFlags);
            renderFlagsList();
          } catch (err) { alert('Could not delete flag: ' + err.message); }
        });
      });
    }

    renderFlagsList();

    main.querySelector('#add-flag-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const input = e.target.querySelector('input[name=flagName]');
      const name = input.value.trim().toLowerCase().replace(/\s+/g, '-');
      if (!name) return;
      if (Object.prototype.hasOwnProperty.call(featureFlags, name)) {
        alert('A flag with that name already exists.');
        return;
      }
      featureFlags[name] = false;
      try {
        await setSetting('feature_flags', featureFlags);
        input.value = '';
        renderFlagsList();
      } catch (err) {
        alert('Could not add flag: ' + err.message);
      }
    });
  }
}
