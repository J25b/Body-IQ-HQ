// Minimal hash-based router. No build step or server config required for
// sub-routes to work correctly on Netlify, and a hard refresh on any route
// never 404s.

const routes = {};
let defaultRoute = '/login';

export function registerRoute(path, renderFn) {
  routes[path] = renderFn;
}

export function setDefaultRoute(path) {
  defaultRoute = path;
}

export function navigate(path) {
  window.location.hash = path;
}

export function currentPath() {
  return window.location.hash.replace(/^#/, '') || defaultRoute;
}

export async function renderCurrentRoute() {
  const path = currentPath();
  const renderFn = routes[path] || routes[defaultRoute];
  const app = document.getElementById('app');
  app.innerHTML = '';
  await renderFn(app);
}

export function startRouter() {
  window.addEventListener('hashchange', renderCurrentRoute);
  renderCurrentRoute();
}
