// Phase Six: Insights. Reads pre-aggregated views only (see schema.sql) —
// most common BMI category, most selected wellness goal, average wellness
// score, and assessment completion rate, all derived from event counts.
//
// Theme usage is deliberately absent here, not missing by accident: Body
// IQ's analytics scope was narrowed on purpose to exclude device, browser,
// OS, and theme tracking. This page says so honestly rather than silently
// omitting a requested insight or quietly re-adding tracking to fill it in.

import { renderAppShell } from '../components/appShell.js';
import { statCardHTML } from '../components/card.js';
import { emptyStateHTML } from '../components/emptyState.js';
import { loadingStateHTML } from '../components/loadingState.js';
import { sb } from '../lib/supabaseClient.js';
import { renderBarChart } from '../components/chart.js';

const GOAL_LABELS = {
  lose: 'Lose weight',
  gain: 'Gain weight',
  maintain: 'Maintain weight',
  improve: 'Feel healthier overall'
};

function capitalize(str) {
  if (!str) return 'Unknown';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function renderInsights(container) {
  const main = await renderAppShell(container, { title: 'Insights' });
  if (!main) return;

  main.innerHTML = loadingStateHTML('Loading insights\u2026');

  const [summaryRes, bmiRes, goalRes] = await Promise.all([
    sb.from('insights_summary').select('*').single(),
    sb.from('insights_bmi_category_breakdown').select('*'),
    sb.from('insights_goal_breakdown').select('*')
  ]);

  if (summaryRes.error) {
    console.error('Insights query failed:', summaryRes.error.message);
    main.innerHTML = `
      <div class="analytics-empty-wrap">
        ${emptyStateHTML({
          iconName: 'insights',
          title: "Couldn't load insights",
          message: 'There was a problem reaching Supabase. Check your connection and Supabase project status, then reload this page.'
        })}
      </div>
    `;
    return;
  }

  const summary = summaryRes.data || {};
  const bmiBreakdown = bmiRes.data || [];
  const goalBreakdown = goalRes.data || [];

  if (!summary.total_bmi_calculations) {
    main.innerHTML = `
      <div class="analytics-empty-wrap">
        ${emptyStateHTML({
          iconName: 'insights',
          title: 'No insights yet',
          message: 'This page will populate automatically once the public Body IQ site starts reporting BMI calculations and completed check-ins.'
        })}
      </div>
    `;
    return;
  }

  const topCategory = bmiBreakdown[0] ? bmiBreakdown[0].bmi_category : '\u2014';
  const topGoal = goalBreakdown[0] ? (GOAL_LABELS[goalBreakdown[0].wellness_goal] || goalBreakdown[0].wellness_goal) : '\u2014';
  const completionRate = summary.total_bmi_calculations
    ? Math.round((summary.total_assessments_completed / summary.total_bmi_calculations) * 100)
    : 0;

  main.innerHTML = `
    <div class="stat-grid">
      ${statCardHTML({ label: 'Most Common BMI Category', value: topCategory })}
      ${statCardHTML({ label: 'Most Selected Goal', value: topGoal })}
      ${statCardHTML({ label: 'Average Wellness Score', value: summary.avg_wellness_score != null ? summary.avg_wellness_score + '/100' : '\u2014' })}
      ${statCardHTML({ label: 'Assessment Completion Rate', value: completionRate + '%', hint: summary.total_assessments_completed + ' of ' + summary.total_bmi_calculations + ' BMI calculations' })}
    </div>

    <div class="chart-grid">
      <div class="chart-card">
        <h3 class="chart-card-title">BMI category distribution</h3>
        <div class="chart-canvas-wrap"><canvas id="bmi-category-chart"></canvas></div>
      </div>
      <div class="chart-card">
        <h3 class="chart-card-title">Wellness goal distribution</h3>
        <div class="chart-canvas-wrap"><canvas id="goal-chart"></canvas></div>
      </div>
    </div>

    <p class="analytics-scope-note">
      Theme usage (light vs. dark) isn't shown here \u2014 Body IQ's analytics scope
      deliberately doesn't track it, along with device, browser, and OS.
    </p>
  `;

  renderBarChart(document.getElementById('bmi-category-chart'), {
    labels: bmiBreakdown.map(function (r) { return r.bmi_category; }),
    data: bmiBreakdown.map(function (r) { return r.calculations; }),
    label: 'Calculations'
  });

  renderBarChart(document.getElementById('goal-chart'), {
    labels: goalBreakdown.map(function (r) { return GOAL_LABELS[r.wellness_goal] || capitalize(r.wellness_goal); }),
    data: goalBreakdown.map(function (r) { return r.selections; }),
    label: 'Selections'
  });
}
