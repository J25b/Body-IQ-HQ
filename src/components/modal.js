// Minimal reusable modal dialog. createModal() builds it, mounts it, and
// hands back { close, element } — the caller wires up its own form/content
// via onMount(modalEl, close).

import { icon } from './icons.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export function createModal({ title, bodyHTML, onMount }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true" aria-label="' + escapeHtml(title) + '">' +
      '<div class="modal-header">' +
        '<h2 class="modal-title">' + escapeHtml(title) + '</h2>' +
        '<button type="button" class="icon-btn modal-close-btn" aria-label="Close">' + icon('close', 16) + '</button>' +
      '</div>' +
      '<div class="modal-body">' + bodyHTML + '</div>' +
    '</div>';

  function close() {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', escHandler);
    setTimeout(function () { overlay.remove(); }, 150);
  }
  function escHandler(e) { if (e.key === 'Escape') close(); }

  overlay.querySelector('.modal-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
  requestAnimationFrame(function () { overlay.classList.add('open'); });

  const modalEl = overlay.querySelector('.modal');
  if (onMount) onMount(modalEl, close);

  return { close: close, element: modalEl };
}
