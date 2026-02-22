/* ═══ Hash Router ═══ */
const Router = {
  routes: [],
  current: null,
  params: {},

  add(path, handler, options = {}) {
    // Convert :param to regex groups
    const regex = new RegExp('^' + path.replace(/:([^/]+)/g, '(?<$1>[^/]+)') + '$');
    this.routes.push({ path, regex, handler, options });
  },

  start() {
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve();
  },

  navigate(path) {
    window.location.hash = '#' + path;
  },

  _resolve() {
    const hash = window.location.hash.slice(1) || '/';
    
    for (const route of this.routes) {
      const match = hash.match(route.regex);
      if (match) {
        // Auth guard
        if (route.options.auth && !AppState.isLoggedIn) {
          this.navigate('/login');
          return;
        }
        // Already logged in, redirect from login
        if (route.options.guest && AppState.isLoggedIn) {
          this.navigate('/');
          return;
        }

        this.params = match.groups || {};
        this.current = route.path;
        
        // Update shell visibility
        const shell = document.getElementById('appShell');
        if (shell) {
          shell.classList.toggle('auth-mode', !!route.options.noShell);
        }

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(n => {
          n.classList.toggle('active', n.dataset.route === route.path || 
            (route.path.startsWith(n.dataset.route) && n.dataset.route !== '/'));
        });

        route.handler(this.params);
        EventBus.emit('route:change', { path: hash, route: route.path, params: this.params });
        return;
      }
    }
    // 404 - go home
    this.navigate('/');
  }
};
window.Router = Router;
