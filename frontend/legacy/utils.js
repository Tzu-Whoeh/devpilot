// ═══════════════════ STATE ═══════════════════
let token = '', currentUser = null, currentSession = '', isStreaming = false;
const $ = id => document.getElementById(id);
const baseUrl = () => { const v = $('cfgBase').value.replace(/\/+$/, ''); return v || location.origin; };
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

