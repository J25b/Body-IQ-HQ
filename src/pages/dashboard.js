import { renderAppShell } from '../components/appShell.js';
import { statCardHTML } from '../components/card.js';
import { emptyStateHTML } from '../components/emptyState.js';
import { loadingStateHTML } from '../components/loadingState.js';
import { sb } from '../lib/supabaseClient.js';

export async function renderDashboard(container) {
  const main = await renderAppShell(container, { title: 'Dashboard' });
  if (!main) return;

  main.innerHTML = loadingStateHTML('Loading dashboard...');

  const { data: summary, error } = await sb
    .from('analytics_summary')
    .select('*')
    .single();

  if (error) {
    console.error(error);

    main.innerHTML = emptyStateHTML({
      iconName: 'analytics',
      title: 'Unable to load dashboard',
      message: error.message
    });

    return;
  }

  main.innerHTML = `
    <div class="stat-grid">

      ${statCardHTML({
        label: 'Total Visitors',
        value: summary.total_visitors || 0
      })}

      ${statCardHTML({
        label: 'Returning Visitors',
        value: summary.returning_visitors || 0
      })}

      ${statCardHTML({
        label: 'BMI Calculations',
        value: summary.total_bmi_calculations || 0
      })}

      ${statCardHTML({
        label: 'Reports Generated',
        value: summary.total_reports_generated || 0
      })}

      ${statCardHTML({
        label: 'Avg. Wellness Score',
        value: summary.average_wellness_score ?? 0
      })}

    </div>
  `;
}
