import { sb } from '../lib/supabaseClient.js';
import { navigate } from '../router.js';

export async function renderLogin(container) {
  let inactivityNotice = '';
  try {
    if (sessionStorage.getItem('bodyiqHqInactivityLogout') === 'true') {
      inactivityNotice = '<p class="form-notice">You were signed out after a period of inactivity.</p>';
      sessionStorage.removeItem('bodyiqHqInactivityLogout');
    }
  } catch (e) {}

  container.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <h1 class="auth-title">BodyIQ HQ</h1>
        <p class="auth-subtitle">Sign in to the management console.</p>
        ${inactivityNotice}
        <form id="login-form" class="auth-form" novalidate>
          <label>Email
            <input type="email" name="email" required autocomplete="email" />
          </label>
          <label>Password
            <input type="password" name="password" required autocomplete="current-password" />
          </label>
          <p class="form-error" id="login-error" hidden></p>
          <button type="submit" class="btn-primary" id="login-submit">Sign in</button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const errorEl = container.querySelector('#login-error');
  const submitBtn = container.querySelector('#login-submit');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function resetButton() {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const formData = new FormData(form);
    const email = formData.get('email').trim();
    const password = formData.get('password');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in\u2026';

    // Check lockout status before even attempting the sign-in — a locked
    // account gets rejected here without touching Supabase Auth at all.
    const lockoutRes = await sb.rpc('check_login_lockout', { p_email: email });
    const lockout = lockoutRes.data && lockoutRes.data[0];

    if (lockout && lockout.is_locked) {
      const minutes = Math.max(1, Math.ceil(lockout.retry_after_seconds / 60));
      showError('Too many failed attempts. Try again in about ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + '.');
      resetButton();
      return;
    }

    const { error } = await sb.auth.signInWithPassword({ email, password });

    // Record the attempt either way — this is what makes lockout
    // detection possible on the next try.
    try {
      await sb.rpc('record_login_attempt', {
        p_email: email,
        p_success: !error,
        p_user_agent: navigator.userAgent
      });
    } catch (logErr) {
      console.warn('Could not record login attempt:', logErr.message);
    }

    if (error) {
      let message = 'Incorrect email or password.';
      if (lockout && lockout.attempts_remaining <= 2) {
        message += ' ' + (lockout.attempts_remaining - 1) + ' attempt' +
          (lockout.attempts_remaining - 1 === 1 ? '' : 's') + ' remaining before a temporary lock.';
      }
      showError(message);
      resetButton();
      return;
    }

    // TODO (future 2FA): Supabase Auth supports TOTP-based MFA natively
    // via supabase.auth.mfa.*. Once enrollment UI exists (Settings), the
    // natural hook is here: after a successful password sign-in, check
    // `const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()`
    // — if currentLevel !== nextLevel, the user has a factor enrolled and
    // needs a challenge/verify step before reaching the dashboard, instead
    // of navigating straight there as below.

    navigate('/dashboard');
  });
}
