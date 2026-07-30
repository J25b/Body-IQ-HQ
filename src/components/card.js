// Small reusable card markup helpers. Phase Four's analytics dashboard will
// reuse statCardHTML for real numbers; for now (Phase Three) pages pass in
// placeholder values since no data collection exists yet.

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export function statCardHTML({ label, value, hint }) {
  return `
    <div class="stat-card">
      <div class="stat-card-label">${escapeHtml(label)}</div>
      <div class="stat-card-value">${escapeHtml(value)}</div>
      ${hint ? `<div class="stat-card-hint">${escapeHtml(hint)}</div>` : ''}
    </div>
  `;
}
