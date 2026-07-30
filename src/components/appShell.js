// The shared sidebar + header shell used by every protected page from
// Phase Three onward. A page calls renderAppShell(container, {title}),
// gets back the <main> mount point, and renders its own content into that
// — it never has to touch sidebar/header markup itself. This is the single
// source of truth for navigation, so adding a Phase Four/Five/etc. page
// later means adding a route + a page file, not editing this file.

import { icon } from './icons.js';
import { getSession, signOut, startInactivityWatcher } from '../lib/authGuard.js';
import { sb } from '../lib/supabaseClient.js';
import { navigate, currentPath } from '../router.js';

const SIDEBAR_KEY = 'bodyiqHqSidebarCollapsed';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/analytics', label: 'Analytics', icon: 'analytics' },
  { path: '/content', label: 'Content', icon: 'content' },
  { path: '/insights', label: 'Insights', icon: 'insights' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
  { path: '/security', label: 'Security', icon: 'security' },
  { path: '/health', label: 'Application Health', icon: 'health' }
];

function getSidebarCollapsed() {
  try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch (e) { return false; }
}
function setSidebarCollapsed(collapsed) {
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? 'true' : 'false'); } catch (e) {}
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// Avoids stacking a fresh document-level Escape listener on every single
// page navigation — each call to renderAppShell replaces the previous one.
let escHandlerRef = null;

export async function renderAppShell(container, { title }) {
  const session = await getSession();
  if (!session) {
    navigate('/login');
    return null;
  }

  const { data: adminRow, error } = await sb
    .from('admins')
    .select('full_name, email')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Could not load admin profile:', error.message);
  }

  const name = (adminRow && adminRow.full_name) || session.user.email;
  const initial = name.trim().charAt(0).toUpperCase() || 'A';
  const activePath = currentPath();
  const collapsed = getSidebarCollapsed();

  container.innerHTML = `
    <div class="shell ${collapsed ? 'shell-collapsed' : ''}" id="shell">
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <div class="sidebar-brand">
          <span class="sidebar-brand-mark">IQ</span>
          <span class="sidebar-brand-text">BodyIQ HQ</span>
        </div>
        <nav class="sidebar-nav">
          ${NAV_ITEMS.map(function (item) {
            const isActive = item.path === activePath;
            return '<a href="#' + item.path + '" class="sidebar-link' + (isActive ? ' active' : '') + '"' +
              (isActive ? ' aria-current="page"' : '') + ' title="' + escapeHtml(item.label) + '">' +
              '<span class="sidebar-link-icon">' + icon(item.icon, 19) + '</span>' +
              '<span class="sidebar-link-label">' + escapeHtml(item.label) + '</span></a>';
          }).join('')}
        </nav>
        <button type="button" class="sidebar-collapse-btn" id="sidebar-collapse-btn" aria-label="Collapse sidebar">
          ${icon('panel', 18)}
          <span class="sidebar-link-label">Collapse</span>
        </button>
      </aside>

      <div class="shell-body">
        <header class="app-header">
          <div class="app-header-left">
            <button type="button" class="icon-btn mobile-only" id="mobile-menu-btn" aria-label="Open navigation">
              ${icon('menu', 20)}
            </button>
            <h1 class="app-header-title">${escapeHtml(title)}</h1>
          </div>
          <div class="app-header-right">
            <label class="header-search">
              ${icon('search', 16)}
              <input type="search" placeholder="Search…" aria-label="Search" disabled />
            </label>
            <button type="button" class="icon-btn" aria-label="Notifications" disabled>
              ${icon('bell', 19)}
            </button>
            <div class="header-profile">
              <span class="header-avatar">${escapeHtml(initial)}</span>
              <span class="header-profile-name">${escapeHtml(name)}</span>
            </div>
            <button type="button" class="icon-btn" id="logout-btn" aria-label="Log out">
              ${icon('logout', 19)}
            </button>
          </div>
        </header>
        <main class="app-main" id="app-main"></main>
      </div>
    </div>
  `;

  const shellEl = container.querySelector('#shell');
  const sidebarEl = container.querySelector('#sidebar');
  const backdropEl = container.querySelector('#sidebar-backdrop');

  // Desktop collapse/expand, persisted across visits
  container.querySelector('#sidebar-collapse-btn').addEventListener('click', function () {
    const nowCollapsed = !shellEl.classList.contains('shell-collapsed');
    shellEl.classList.toggle('shell-collapsed', nowCollapsed);
    setSidebarCollapsed(nowCollapsed);
  });

  // Mobile slide-out drawer
  function openDrawer() {
    shellEl.classList.add('sidebar-open');
    const firstLink = sidebarEl.querySelector('.sidebar-link');
    if (firstLink) firstLink.focus();
  }
  function closeDrawer() {
    shellEl.classList.remove('sidebar-open');
  }
  container.querySelector('#mobile-menu-btn').addEventListener('click', openDrawer);
  backdropEl.addEventListener('click', closeDrawer);
  sidebarEl.querySelectorAll('.sidebar-link').forEach(function (link) {
    link.addEventListener('click', closeDrawer);
  });

  if (escHandlerRef) document.removeEventListener('keydown', escHandlerRef);
  escHandlerRef = function (e) { if (e.key === 'Escape') closeDrawer(); };
  document.addEventListener('keydown', escHandlerRef);

  // Logout
  container.querySelector('#logout-btn').addEventListener('click', async function () {
    await signOut();
    navigate('/login');
  });

  // Restarts on every page render, so navigating around the console
  // counts as activity; only genuine idle time triggers a sign-out.
  startInactivityWatcher(function () {
    navigate('/login');
  });

  return container.querySelector('#app-main');
}
