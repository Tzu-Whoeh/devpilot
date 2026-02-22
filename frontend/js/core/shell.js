/* ═══ Shell Layout Manager ═══ */
const Shell = {
  init() {
    this.renderSidebar();
    this.renderTopbar();
    this._bindMobile();
  },

  renderSidebar() {
    const sb = document.getElementById('shellSidebar');
    if (!sb) return;
    const user = AppState.user;
    const initial = user ? user.username.charAt(0).toUpperCase() : 'U';
    const name = user ? user.username : 'User';

    sb.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-logo">DP</div>
        <div class="sidebar-brand">Dev<span>Pilot</span></div>
      </div>
      <nav class="sidebar-nav">
        <a class="nav-item" data-route="/" onclick="Router.navigate('/');Shell.closeMobile()">
          <span class="nav-icon">📊</span><span class="nav-label">项目总览</span>
        </a>
        <a class="nav-item" data-route="/new" onclick="Router.navigate('/new');Shell.closeMobile()">
          <span class="nav-icon">✨</span><span class="nav-label">新建项目</span>
        </a>
        <a class="nav-item" data-route="/chat" onclick="Router.navigate('/chat');Shell.closeMobile()">
          <span class="nav-icon">💬</span><span class="nav-label">AI 对话</span>
        </a>
        <a class="nav-item" data-route="/settings" onclick="Router.navigate('/settings');Shell.closeMobile()">
          <span class="nav-icon">⚙️</span><span class="nav-label">设置</span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="user-avatar">${initial}</div>
          <span class="user-name">${_esc(name)}</span>
          <span class="user-logout" onclick="Shell.logout()" title="退出登录">⏻</span>
        </div>
      </div>
    `;
  },

  renderTopbar() {
    // Topbar is updated per-page via setBreadcrumb
  },

  setBreadcrumb(items) {
    const tb = document.getElementById('shellTopbar');
    if (!tb) return;
    const crumbs = items.map((item, i) => {
      const isLast = i === items.length - 1;
      return (i > 0 ? '<span class="breadcrumb-sep">›</span>' : '') +
        (isLast ? `<span class="breadcrumb-current">${item.label}</span>` :
         `<span style="cursor:pointer;color:var(--text-dim)" onclick="Router.navigate('${item.path}')">${item.label}</span>`);
    }).join('');

    tb.innerHTML = `
      <button class="mobile-menu-btn" onclick="Shell.toggleMobile()">☰</button>
      <div class="topbar-breadcrumb">${crumbs}</div>
      <div class="topbar-actions"></div>
    `;
  },

  setContent(html) {
    const el = document.getElementById('shellContent');
    if (el) {
      el.innerHTML = html;
      el.scrollTop = 0;
      el.querySelector('.page-container,.chat-page')?.classList.add('page-enter');
    }
  },

  toggleMobile() {
    document.getElementById('shellSidebar')?.classList.toggle('open');
    document.getElementById('sidebarOverlay')?.classList.toggle('open');
  },
  closeMobile() {
    document.getElementById('shellSidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');
  },
  _bindMobile() {
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => this.closeMobile());
  },

  logout() {
    AppState.clear();
    Router.navigate('/login');
  },

  toast(msg, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
  }
};

// Escape HTML
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

window.Shell = Shell;
window._esc = _esc;
