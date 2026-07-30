import { icon } from './icons.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export function emptyStateHTML({ iconName = 'inbox', title, message, actionLabel, actionHref }) {
  const action = (actionLabel && actionHref)
    ? `<a class="btn-secondary" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>`
    : '';
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon(iconName, 26)}</div>
      <h3 class="empty-state-title">${escapeHtml(title)}</h3>
      <p class="empty-state-message">${escapeHtml(message)}</p>
      ${action}
    </div>
  `;
}
