/* ═══ API Client v3.1 — Module-level Mock Switch ═══
 *
 * Changelog v3.1 (UX-DEVPILOT-CHAT-001):
 *   Task-2: streamChat accepts single message instead of full history
 *   Task-3: SSE event parser handles Responses API event types
 *   Task-5: getAgents normalizes response data
 *
 * 模块状态:
 *   auth     ✅ 已完成 — 永远走后端
 *   admin    ✅ 已完成 — 永远走后端
 *   chat     ✅ 已完成 — 永远走后端（SSE streaming, agents）
 *   projects ❌ 未完成 — Mock
 *   templates❌ 未完成 — Mock
 *   phases   ❌ 未完成 — Mock
 * ═══════════════════════════════════════════════ */

const CONFIG = {
  /** Module-level mock switches — true = use mock */
  MOCK: {
    auth:      false,   // ✅ 后端已完成
    admin:     false,   // ✅ 后端已完成
    chat:      false,   // ✅ 后端已完成（SSE + agents）
    projects:  true,    // ❌ PCC Core 未完成
    templates: true,    // ❌ PCC Core 未完成
    phases:    true,    // ❌ PCC Core 未完成
  },

  /** @deprecated — 兼容旧代码，读取 USE_MOCK 时映射到 projects */
  get USE_MOCK() { return this.MOCK.projects; },
  set USE_MOCK(v) {
    // Legacy: 全局开关只影响未完成模块
    this.MOCK.projects = v;
    this.MOCK.templates = v;
    this.MOCK.phases = v;
  },

  BASE_URL: '',
  getBaseUrl() {
    if (this.BASE_URL) return this.BASE_URL;
    return window.location.origin;
  }
};

const API = {
  // ══════════════════════════════════════════════════════
  //  AUTH — ✅ 已完成，永远走后端
  // ══════════════════════════════════════════════════════
  async login(username, password) {
    if (CONFIG.MOCK.auth) return MockAPI.login(username, password);
    const res = await fetch(CONFIG.getBaseUrl() + '/auth/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Login failed');
    return data;
  },

  async register(username, password, email) {
    if (CONFIG.MOCK.auth) return MockAPI.register(username, password, email);
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

  // ══════════════════════════════════════════════════════
  //  ADMIN — ✅ 已完成，永远走后端
  // ══════════════════════════════════════════════════════
  async getAIConfig() {
    return this._get('/admin/ai-config');
  },
  async updateAIConfig(data) {
    const res = await fetch(CONFIG.getBaseUrl() + '/admin/ai-config', {
      method: 'PUT', headers: { ...this._headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return this._handle(res);
  },
  async testAIConfig() {
    return this._post('/admin/ai-config/test');
  },

  // ══════════════════════════════════════════════════════
  //  CHAT / AGENTS — ✅ 已完成，永远走后端
  // ══════════════════════════════════════════════════════

  /** Task-5: Get agents with normalized response */
  async getAgents() {
    const res = await fetch(CONFIG.getBaseUrl() + '/chat/agents', {
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`获取 Agent 列表失败: ${res.status}`);
    const data = await res.json();
    const agents = data.agents || data;
    // Normalize: ensure each agent value is an object with at least {name, description}
    for (const [id, info] of Object.entries(agents)) {
      if (typeof info === 'string') {
        agents[id] = { name: info, description: '' };
      } else if (info && typeof info === 'object') {
        if (!info.name) info.name = id;
        if (!info.description) info.description = '';
      }
    }
    return agents;
  },

  /**
   * Task-2: streamChat — sends only the current message + user field.
   * Server maintains conversation context via the `user` identifier.
   *
   * @param {Object} opts
   * @param {string} opts.model - Agent ID
   * @param {string} opts.message - Current user message text (single message, not array)
   * @param {string} opts.user - Session identifier for server-side context
   * @param {AbortSignal} opts.signal
   * @param {Function} opts.onDelta - Called with (deltaText) for each chunk
   * @param {Function} opts.onDone - Called with (fullText) when complete
   * @param {Function} opts.onError - Called with (Error) on failure
   */
  async streamChat({ model, message, messages, user, signal, onDelta, onDone, onError }) {
    try {
      // Task-2: Build messages array — prefer single message, fallback to full array
      const msgArray = messages || [{ role: 'user', content: message }];
      const res = await fetch(CONFIG.getBaseUrl() + '/chat/chat/completions', {
        method: 'POST',
        headers: {
          ...this._headers(),
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ model, messages: msgArray, stream: true, user }),
        signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.detail || `HTTP ${res.status}`);
      }
      await this._consumeSSE(res, { onDelta, onDone, onError });
    } catch (e) {
      if (e.name === 'AbortError') return;
      onError?.(e);
    }
  },

  /**
   * Task-2: streamResponses — sends only current input + user field.
   */
  async streamResponses({ model, input, user, signal, onDelta, onDone, onError }) {
    try {
      const res = await fetch(CONFIG.getBaseUrl() + '/chat/responses', {
        method: 'POST',
        headers: {
          ...this._headers(),
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ model, input, stream: true, user }),
        signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.detail || `HTTP ${res.status}`);
      }
      await this._consumeSSE(res, { onDelta, onDone, onError });
    } catch (e) {
      if (e.name === 'AbortError') return;
      onError?.(e);
    }
  },

  /**
   * Task-3: Unified SSE consumer — handles both Chat Completions and Responses API events.
   *
   * Supports:
   *   - Chat Completions: data.choices[0].delta.content
   *   - Responses API: event:response.output_text.delta → data.delta
   *   - Responses API: event:response.output_text.done → data.text (complete)
   *   - Responses API: event:response.completed → end
   */
  async _consumeSSE(response, { onDelta, onDone, onError }) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let currentEvent = '';  // Task-3: track SSE event type
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t || t.startsWith(':')) continue;

          // Task-3: Track event type from `event:` lines
          if (t.startsWith('event:')) {
            currentEvent = t.slice(6).trim();
            continue;
          }

          if (t === 'data: [DONE]') { onDone?.(fullText); return; }
          if (!t.startsWith('data: ')) continue;

          try {
            const parsed = JSON.parse(t.slice(6));

            // Error handling
            if (parsed.error) {
              onError?.(new Error(parsed.error.message || JSON.stringify(parsed.error)));
              return;
            }

            let delta = '';
            const evtType = currentEvent || parsed?.type || '';

            // ── Responses API events ──
            if (evtType === 'response.output_text.delta') {
              delta = parsed.delta || '';
            } else if (evtType === 'response.output_text.done') {
              // Done event contains complete text; use it for final verification
              if (parsed.text) fullText = parsed.text;
              onDone?.(fullText);
              return;
            } else if (evtType === 'response.completed' || evtType === 'response.done') {
              onDone?.(fullText);
              return;
            }
            // ── Responses API: function call events (placeholder for Phase 2) ──
            else if (evtType.startsWith('response.function_call_arguments')) {
              // Future: handle function calling
              // For now, skip silently
            }
            // ── Chat Completions format (fallback) ──
            else {
              const choice = parsed?.choices?.[0];
              if (choice) {
                delta = choice.delta?.content || '';
                if (choice.finish_reason === 'stop') {
                  if (delta) { fullText += delta; onDelta?.(delta); }
                  onDone?.(fullText);
                  return;
                }
              }
              // Also handle bare delta field (some API variants)
              if (!delta && typeof parsed?.delta === 'string') {
                delta = parsed.delta;
              }
            }

            if (delta) {
              fullText += delta;
              onDelta?.(delta);
            }

            // Reset event type after processing data line
            currentEvent = '';
          } catch (_) {}
        }
      }
      onDone?.(fullText);
    } catch (e) {
      if (e.name !== 'AbortError') onError?.(e);
    }
  },

  // ══════════════════════════════════════════════════════
  //  PROJECTS / TEMPLATES / PHASES — ❌ Mock（后端未完成）
  // ══════════════════════════════════════════════════════
  async getTemplateTypes() {
    if (CONFIG.MOCK.templates) return MockAPI.getTemplateTypes();
    return this._get('/api/v1/templates/types');
  },
  async getTemplatePhases(typeKey) {
    if (CONFIG.MOCK.templates) return MockAPI.getTemplatePhases(typeKey);
    return this._get(`/api/v1/templates/types/${typeKey}/phases`);
  },

  async getProjects() {
    if (CONFIG.MOCK.projects) return MockAPI.getProjects();
    return this._get('/projects');
  },
  async getProject(id) {
    if (CONFIG.MOCK.projects) return MockAPI.getProject(id);
    return this._get(`/projects/${id}`);
  },
  async createProject(data) {
    if (CONFIG.MOCK.projects) return MockAPI.createProject(data);
    return this._post('/projects', data);
  },

  async triggerPhase(projectId, phaseId) {
    if (CONFIG.MOCK.phases) return MockAPI.triggerPhase(projectId, phaseId);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/trigger`);
  },
  async approvePhase(projectId, phaseId) {
    if (CONFIG.MOCK.phases) return MockAPI.approvePhase(projectId, phaseId);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/approve`);
  },
  async rejectPhase(projectId, phaseId) {
    if (CONFIG.MOCK.phases) return MockAPI.rejectPhase(projectId, phaseId);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/reject`);
  },
  async regeneratePhase(projectId, phaseId, additionalReq) {
    if (CONFIG.MOCK.phases) return MockAPI.regeneratePhase(projectId, phaseId, additionalReq);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/regenerate`, { additional_requirements: additionalReq });
  },

  async sendChat(projectId, phaseId, message) {
    if (CONFIG.MOCK.phases) return MockAPI.sendChat(projectId, phaseId, message);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/chat`, { message });
  },
  async sendFreeChat(message) {
    if (CONFIG.MOCK.phases) return MockAPI.sendFreeChat(message);
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

// ══════════════════════════════════════════════════════
//  REQUEST LOGGER — captures all requests/responses for Debug page
// ══════════════════════════════════════════════════════
const RequestLog = {
  _entries: [],
  _maxEntries: 200,
  _listeners: [],

  add(entry) {
    entry.id = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    entry.timestamp = new Date().toISOString();
    this._entries.unshift(entry);
    if (this._entries.length > this._maxEntries) this._entries.pop();
    this._listeners.forEach(fn => fn(entry));
  },

  getAll() { return this._entries; },
  clear() { this._entries = []; this._listeners.forEach(fn => fn(null)); },
  onEntry(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter(f => f !== fn); }; },
};

const _origFetch = window.fetch;
window.fetch = async function(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const urlStr = typeof url === 'string' ? url : url.toString();
  const logEntry = {
    method, url: urlStr,
    requestHeaders: { ...(opts.headers || {}) },
    requestBody: null,
    status: null, statusText: '',
    responseHeaders: {},
    responseBody: null,
    duration: 0,
    error: null,
    isSSE: false,
  };
  if (logEntry.requestHeaders['Authorization']) {
    const token = logEntry.requestHeaders['Authorization'];
    logEntry.requestHeaders['Authorization'] = token.slice(0, 15) + '...' + token.slice(-6);
  }
  if (opts.body && typeof opts.body === 'string') {
    try { logEntry.requestBody = JSON.parse(opts.body); } catch(_) { logEntry.requestBody = opts.body.slice(0, 500); }
  }
  logEntry.isSSE = (opts.headers?.['Accept'] || '').includes('text/event-stream');

  const startTime = performance.now();
  try {
    const response = await _origFetch.call(window, url, opts);
    logEntry.duration = Math.round(performance.now() - startTime);
    logEntry.status = response.status;
    logEntry.statusText = response.statusText;
    response.headers.forEach((v, k) => { logEntry.responseHeaders[k] = v; });
    if (!logEntry.isSSE && response.headers.get('content-type')?.includes('json')) {
      const clone = response.clone();
      clone.json().then(data => { logEntry.responseBody = data; RequestLog.add(logEntry); }).catch(() => { RequestLog.add(logEntry); });
    } else {
      if (logEntry.isSSE) logEntry.responseBody = '(SSE stream)';
      RequestLog.add(logEntry);
    }
    return response;
  } catch (e) {
    logEntry.duration = Math.round(performance.now() - startTime);
    logEntry.error = e.message;
    RequestLog.add(logEntry);
    throw e;
  }
};

window.CONFIG = CONFIG;
window.API = API;
window.RequestLog = RequestLog;
