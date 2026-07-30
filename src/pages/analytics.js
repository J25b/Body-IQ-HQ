// Phase Four: Analytics dashboard. Reads from the aggregation views defined
// in supabase/schema.sql — never queries the raw `events` table directly,
// so this page has no idea what an individual visitor did, only totals.
//
// Scope note: Body IQ intentionally tracks a narrow set of events (visits,
// BMI calculations by category, report downloads) and nothing about
// device, browser, OS, theme, or session duration. The device/browser/OS/
// theme aggregation views still exist in schema.sql in case that scope
// ever changes, but this page doesn't query or render them, since they'll
// never have data under the current policy — showing permanently-empty
// charts would be more confusing than just not showing them.

import { renderAppShell } from '../components/appShell.js';
import { statCardHTML } from '../components/card.js';
import { emptyStateHTML } from '../components/emptyState.js';
import { loadingStateHTML } from '../components/loadingState.js';
import { sb } from '../lib/supabaseClient.js';
import { renderLineChart } from '../components/chart.js';

export async function renderAnalytics(container) {
  const main = await renderAppShell(container, { title: 'Analytics' });
  if (!main) return;

  main.innerHTML = loadingStateHTML('Loading analytics\u2026');

  const [summaryRes, growthRes] = await Promise.all([
    sb.from('analytics_summary').select('*').single(),
    sb.from('analytics_growth_daily').select('*')
  ]);

  if (summaryRes.error) {
    console.error('Analytics query failed:', summaryRes.error.message);
    main.innerHTML = `
      <div class="analytics-empty-wrap">
        ${emptyStateHTML({
          iconName: 'analytics',
          title: "Couldn't load analytics",
          message: 'There was a problem reaching Supabase. Check your connection and Supabase project status, then reload this page.'
        })}
      </div>
    `;
    return;
  }

  const summary = summaryRes.data || {};
  const totalVisitors = summary.total_visitors || 0;

  if (!totalVisitors) {
    main.innerHTML = `
      <div class="analytics-empty-wrap">
        ${emptyStateHTML({
          iconName: 'analytics',
          title: 'No analytics data yet',
          message: 'This dashboard is fully built and will populate automatically the moment the public Body IQ site starts reporting anonymous visit and BMI-calculation counts.'
        })}
      </div>
    `;
    return;
  }

  main.innerHTML = `
    <div class="stat-grid">
      ${statCardHTML({ label: 'Total Visitors', value: totalVisitors })}
      ${statCardHTML({ label: 'Returning Visitors', value: summary.returning_visitors || 0 })}
      ${statCardHTML({ label: 'BMI Calculations', value: summary.total_bmi_calculations || 0 })}
      ${statCardHTML({ label: 'Reports Generated', value: summary.total_reports_generated || 0 })}
    </div>

    <div class="chart-grid">
      <div class="chart-card chart-card-wide">
        <h3 class="chart-card-title">Visitor growth \u00b7 last 30 days</h3>
        <div class="chart-canvas-wrap"><canvas id="growth-chart"></canvas></div>
      </div>
    </div>

    <p class="analytics-scope-note">
      Body IQ deliberately doesn't collect device, browser, OS, theme, or session-duration
      data \u2014 only visit and BMI-calculation counts, to keep the data footprint minimal.
    </p>
  `;

  const growth = growthRes.data || [];
  renderLineChart(document.getElementById('growth-chart'), {
    labels: growth.map(function (r) { return formatDay(r.day); }),
    data: growth.map(function (r) { return r.visitors; }),
    label: 'Visitors'
  });
}

function formatDay(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
