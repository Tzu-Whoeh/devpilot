// ═══════════════════ BOOT ═══════════════════
(function boot() {
  const saved = localStorage.getItem('dp_session');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s.token && s.user && s.exp > Date.now()) {
        token = s.token; currentUser = s.user;
        if (s.baseUrl) $('cfgBase').value = s.baseUrl;
        enterChat(); return;
      }
    } catch(e) { console.error('[Boot] restore failed:', e); }
    localStorage.removeItem('dp_session');
  }
})();
