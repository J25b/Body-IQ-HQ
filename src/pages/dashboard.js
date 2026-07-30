// Phase Three: real dashboard layout (sidebar, header, overview grid) via
// the shared app shell. The stat cards show placeholder values with an
// honest hint rather than fake numbers, since Phase Four is what actually
// wires up anonymous analytics collection.

import { renderAppShell } from '../components/appShell.js';
import { statCardHTML } from '../components/card.js';
import { emptyStateHTML } from '../components/emptyState.js';

export async function renderDashboard(container) {
  const main = await renderAppShell(container, { title: 'Dashboard' });
  if (!main) return;

  main.innerHTML = `
    <div class="stat-grid">
      ${statCardHTML({ label: 'Total Visitors', value: '\u2014', hint: 'Tracking arrives in Phase Four' })}
      ${statCardHTML({ label: 'BMI Calculations', value: '\u2014', hint: 'Tracking arrives in Phase Four' })}
      ${statCardHTML({ label: 'Reports Generated', value: '\u2014', hint: 'Tracking arrives in Phase Four' })}
      ${statCardHTML({ label: 'Avg. Wellness Score', value: '\u2014', hint: 'Tracking arrives in Phase Four' })}
    </div>
    <div class="dashboard-empty-wrap">
      ${emptyStateHTML({
        iconName: 'analytics',
        title: 'No analytics yet',
        message: 'Once Phase Four wires up anonymous event tracking on the public site, your overview will populate here automatically \u2014 no changes needed on this page.'
      })}
    </div>
  `;
}
