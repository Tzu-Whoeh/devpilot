/* ═══ API Client — Mock/Real Switch ═══ */
const CONFIG = {
  USE_MOCK: true,
  BASE_URL: '',
  getBaseUrl() {
    if (this.BASE_URL) return this.BASE_URL;
    return window.location.origin;
  }
};

const API = {
  // ── Auth (always real if available) ──
  async login(username, password) {
    if (CONFIG.USE_MOCK) return MockAPI.login(username, password);
    const res = await fetch(CONFIG.getBaseUrl() + '/auth/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Login failed');
    return data;
  },

  async register(username, password, email) {
    if (CONFIG.USE_MOCK) return MockAPI.register(username, password, email);
    const body = { username, password };
    if (email) body.email = email;
    const res = await fetch(CONFIG.getBaseUrl() + '/auth/register', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Register failed');
    return data;
  },

  // ── Templates ──
  async getTemplateTypes() {
    if (CONFIG.USE_MOCK) return MockAPI.getTemplateTypes();
    return this._get('/api/v1/templates/types');
  },

  async getTemplatePhases(typeKey) {
    if (CONFIG.USE_MOCK) return MockAPI.getTemplatePhases(typeKey);
    return this._get(`/api/v1/templates/types/${typeKey}/phases`);
  },

  // ── Projects ──
  async getProjects() {
    if (CONFIG.USE_MOCK) return MockAPI.getProjects();
    return this._get('/api/v1/projects');
  },

  async getProject(id) {
    if (CONFIG.USE_MOCK) return MockAPI.getProject(id);
    return this._get(`/api/v1/projects/${id}`);
  },

  async createProject(data) {
    if (CONFIG.USE_MOCK) return MockAPI.createProject(data);
    return this._post('/api/v1/projects', data);
  },

  // ── Phase Lifecycle ──
  async triggerPhase(projectId, phaseId) {
    if (CONFIG.USE_MOCK) return MockAPI.triggerPhase(projectId, phaseId);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/trigger`);
  },

  async approvePhase(projectId, phaseId) {
    if (CONFIG.USE_MOCK) return MockAPI.approvePhase(projectId, phaseId);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/approve`);
  },

  async rejectPhase(projectId, phaseId) {
    if (CONFIG.USE_MOCK) return MockAPI.rejectPhase(projectId, phaseId);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/reject`);
  },

  async regeneratePhase(projectId, phaseId, additionalReq) {
    if (CONFIG.USE_MOCK) return MockAPI.regeneratePhase(projectId, phaseId, additionalReq);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/regenerate`, { additional_requirements: additionalReq });
  },

  // ── Chat ──
  async sendChat(projectId, phaseId, message) {
    if (CONFIG.USE_MOCK) return MockAPI.sendChat(projectId, phaseId, message);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/chat`, { message });
  },

  async sendFreeChat(message) {
    if (CONFIG.USE_MOCK) return MockAPI.sendFreeChat(message);
    return this._post('/api/v1/ai/chat', { message });
  },

  // ── HTTP Helpers ──
  async _get(path) {
    const res = await fetch(CONFIG.getBaseUrl() + path, { headers: this._headers() });
    return this._handle(res);
  },
  async _post(path, body) {
    const res = await fetch(CONFIG.getBaseUrl() + path, {
      method: 'POST', headers: { ...this._headers(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return this._handle(res);
  },
  _headers() {
    const h = {};
    if (AppState.token) h['Authorization'] = 'Bearer ' + AppState.token;
    return h;
  },
  async _handle(res) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return data;
  }
};

window.CONFIG = CONFIG;
window.API = API;
