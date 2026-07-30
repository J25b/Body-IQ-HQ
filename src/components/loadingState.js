function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export function loadingStateHTML(message) {
  return `
    <div class="loading-state">
      <div class="spinner" aria-hidden="true"></div>
      <p class="loading-state-message">${escapeHtml(message || 'Loading…')}</p>
    </div>
  `;
}
