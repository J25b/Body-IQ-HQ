// Factory for the placeholder pages of sections that aren't built yet
// (Analytics, Content, Insights, Settings, Security, Application Health).
// Each still gets full sidebar/header navigation via renderAppShell, so the
// console feels complete now rather than having dead links — the empty
// state just tells you honestly what phase brings the real content.

import { renderAppShell } from '../components/appShell.js';
import { emptyStateHTML } from '../components/emptyState.js';

export function makeComingSoonPage({ title, iconName, phaseLabel, description }) {
  return async function render(container) {
    const main = await renderAppShell(container, { title: title });
    if (!main) return;

    main.innerHTML = `
      <div class="coming-soon-wrap">
        ${emptyStateHTML({ iconName: iconName, title: phaseLabel, message: description })}
      </div>
    `;
  };
}
