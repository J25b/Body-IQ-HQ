// First-run administrator account creation. Only ever reachable when
// hasAdmin() returns false (see main.js boot sequence). Even if this page
// were somehow reached a second time, the database-level RLS policy on
// the `admins` table (see supabase/schema.sql) refuses a second insert,
// so the single-admin rule is enforced by Postgres, not by this file.

import { sb } from '../lib/supabaseClient.js';
import { navigate } from '../router.js';

export async function renderSetup(container) {
  container.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <h1 class="auth-title">Create your administrator account</h1>
        <p class="auth-subtitle">
          This setup runs once. After this account is created, public
          registration is disabled and only the login page will be shown.
        </p>
        <form id="setup-form" class="auth-form" novalidate>
          <label>Full name
            <input type="text" name="fullName" required autocomplete="name" />
          </label>
          <label>Email
            <input type="email" name="email" required autocomplete="email" />
          </label>
          <label>Password
            <input type="password" name="password" required minlength="8" autocomplete="new-password" />
          </label>
          <label>Confirm password
            <input type="password" name="confirmPassword" required minlength="8" autocomplete="new-password" />
          </label>
          <p class="form-error" id="setup-error" hidden></p>
          <p class="form-notice" id="setup-notice" hidden></p>
          <button type="submit" class="btn-primary" id="setup-submit">Create administrator account</button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#setup-form');
  const errorEl = container.querySelector('#setup-error');
  const noticeEl = container.querySelector('#setup-notice');
  const submitBtn = container.querySelector('#setup-submit');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    noticeEl.hidden = true;
  }

  function resetButton() {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create administrator account';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    noticeEl.hidden = true;

    const formData = new FormData(form);
    const fullName = formData.get('fullName').trim();
    const email = formData.get('email').trim();
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    if (password.length < 8) {
      showError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    const { data, error } = await sb.auth.signUp({ email, password });

    if (error) {
      showError(error.message);
      resetButton();
      return;
    }

    if (!data.user) {
      showError('Something went wrong creating your account. Please try again.');
      resetButton();
      return;
    }

    const { error: insertError } = await sb.from('admins').insert({
      id: data.user.id,
      full_name: fullName,
      email: email
    });

    if (insertError) {
      showError(
        'Your login was created, but the administrator record could not be ' +
        'saved (' + insertError.message + '). If an administrator already ' +
        'exists, registration is disabled and you should use the login page.'
      );
      resetButton();
      return;
    }

    if (data.session) {
      navigate('/dashboard');
    } else {
      // Supabase's "Confirm email" setting is turned on for this project,
      // so no session exists yet until the address is confirmed.
      noticeEl.textContent = 'Account created. Check your email to confirm your address, then log in.';
      noticeEl.hidden = false;
      submitBtn.textContent = 'Account created';
    }
  });
}
