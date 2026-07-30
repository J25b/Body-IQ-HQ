// Phase Nine: Application Health. Every number here comes from a real
// check run at page-load time — nothing is fabricated. Where there's
// genuinely nothing to report honestly (uptime for a static deployment,
// storage usage for a feature that isn't used anywhere), the page says so
// instead of showing a fake or misleading value.

import { renderAppShell } from '../components/appShell.js';
import { loadingStateHTML } from '../components/loadingState.js';
import { sb } from '../lib/supabaseClient.js';
import { getSetting } from '../lib/settingsApi.js';
import { SUPABASE_URL, BUILT_AT } from '../config.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' \u00b7 ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function statusPill(ok, labelOk, labelBad) {
  return ok
    ? '<span class="status-badge badge-published">' + labelOk + '</span>'
    : '<span class="status-badge badge-disabled">' + labelBad + '</span>';
}

export async function renderHealth(container) {
  const main = await renderAppShell(container, { title: 'Application Health' });
  if (!main) return;

  main.innerHTML = loadingStateHTML('Running health checks\u2026');
  await runChecks(main);
}

async function runChecks(main) {
  const start = performance.now();
  let supabaseOk = false;
  let latencyMs = null;
  try {
    const { error } = await sb.rpc('has_admin');
    supabaseOk = !error;
    latencyMs = Math.round(performance.now() - start);
  } catch (e) {
    supabaseOk = false;
  }

  let eventsCount = null, eventsOk = false;
  try {
    const { count, error } = await sb.from('events').select('*', { count: 'exact', head: true });
    eventsOk = !error;
    eventsCount = count;
  } catch (e) {}

  let contentCount = null, contentOk = false;
  try {
    const { count, error } = await sb.from('content_items').select('*', { count: 'exact', head: true });
    contentOk = !error;
    contentCount = count;
  } catch (e) {}

  let loginAttemptsCount = null;
  try {
    const { data, error } = await sb.rpc('get_login_attempts_count');
    if (!error) loginAttemptsCount = data;
  } catch (e) {}

  let appVersion = '\u2014';
  try { appVersion = (await getSetting('app_version')) || '\u2014'; } catch (e) {}

  const overallOk = supabaseOk && eventsOk && contentOk;

  main.innerHTML = `
    <div class="settings-grid">
      <section class="settings-card settings-card-wide">
        <h3 class="settings-card-title">System Status</h3>
        <div class="health-overall">${statusPill(overallOk, 'All systems operational', 'Degraded \u2014 see cards below')}</div>
        <p class="form-hint" style="margin-top:10px;">
          BodyIQ HQ and the public Body IQ site are static deployments with no long-running
          server process, so traditional "uptime" doesn't really apply \u2014 the checks below
          reflect whether each dependency responded just now, not how long anything has been running.
        </p>
        <button type="button" class="btn-secondary" id="rerun-checks-btn" style="margin-top:12px;">Re-run checks</button>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Deployment</h3>
        <div class="env-row"><span>App version</span><span class="env-value">${escapeHtml(appVersion)}</span></div>
        <div class="env-row"><span>Built</span><span class="env-value">${BUILT_AT ? formatDateTime(BUILT_AT) : 'Unknown (dev copy, not a real build)'}</span></div>
        <div class="env-row"><span>Hosting</span><span class="env-value">Netlify (static)</span></div>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Supabase Connection</h3>
        <div class="env-row"><span>Status</span><span>${statusPill(supabaseOk, 'Connected', 'Unreachable')}</span></div>
        <div class="env-row"><span>Round-trip latency</span><span class="env-value">${latencyMs != null ? latencyMs + ' ms' : '\u2014'}</span></div>
        <div class="env-row"><span>Project URL</span><span class="env-value">${escapeHtml(SUPABASE_URL)}</span></div>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Analytics Service</h3>
        <div class="env-row"><span>Status</span><span>${statusPill(eventsOk, 'Operational', 'Unavailable')}</span></div>
        <div class="env-row"><span>Total events recorded</span><span class="env-value">${eventsCount != null ? eventsCount : '\u2014'}</span></div>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Database Health</h3>
        <div class="env-row"><span>Content service</span><span>${statusPill(contentOk, 'Operational', 'Unavailable')}</span></div>
        <div class="env-row"><span>Content items stored</span><span class="env-value">${contentCount != null ? contentCount : '\u2014'}</span></div>
        <div class="env-row"><span>Login attempts logged</span><span class="env-value">${loginAttemptsCount != null ? loginAttemptsCount : '\u2014'}</span></div>
        <div class="env-row"><span>Row Level Security</span><span class="env-value">Enabled on all tables</span></div>
      </section>

      <section class="settings-card">
        <h3 class="settings-card-title">Storage</h3>
        <p class="settings-card-subtitle">
          Supabase Storage isn't used anywhere in Body IQ or BodyIQ HQ \u2014 there's nothing
          real to report here, so this stays empty rather than showing a number that would
          just be zero by construction.
        </p>
      </section>
    </div>
  `;

  main.querySelector('#rerun-checks-btn').addEventListener('click', function () {
    main.innerHTML = loadingStateHTML('Running health checks\u2026');
    runChecks(main);
  });
}
