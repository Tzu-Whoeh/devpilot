/* ═══ API Client — Mock/Real Switch ═══ */
const CONFIG = {
  USE_MOCK: false,
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

  // ── Chat (legacy) ──
  async sendChat(projectId, phaseId, message) {
    if (CONFIG.USE_MOCK) return MockAPI.sendChat(projectId, phaseId, message);
    return this._post(`/api/v1/projects/${projectId}/phases/${phaseId}/chat`, { message });
  },
  async sendFreeChat(message) {
    if (CONFIG.USE_MOCK) return MockAPI.sendFreeChat(message);
    return this._post('/api/v1/ai/chat', { message });
  },

  // ── Admin: AI Configuration ──
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
  //  NEW: Agents + SSE Streaming
  // ══════════════════════════════════════════════════════

  /** Fetch available agents list */
  async getAgents() {
    const res = await fetch(CONFIG.getBaseUrl() + '/chat/agents', {
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`获取 Agent 列表失败: ${res.status}`);
    const data = await res.json();
    return data.agents || data;
  },

  /**
   * SSE streaming via OpenAI-compatible Chat Completions (text only).
   * @param {Object} opts
   * @param {string} opts.model - Agent / model ID
   * @param {Array}  opts.messages - [{role, content}]
   * @param {string} opts.user - Session key for isolation
   * @param {AbortSignal} opts.signal
   * @param {Function} opts.onDelta(text) - Incremental text
   * @param {Function} opts.onDone(fullText) - Stream complete
   * @param {Function} opts.onError(err)
   */
  async streamChat({ model, messages, user, signal, onDelta, onDone, onError }) {
    try {
      const res = await fetch(CONFIG.getBaseUrl() + '/chat/openai/chat/completions', {
        method: 'POST',
        headers: {
          ...this._headers(),
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ model, messages, stream: true, user }),
        signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.detail || `HTTP ${res.status}`);
      }
      await this._consumeSSE(res, {
        onData(parsed) {
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) onDelta(delta);
          if (parsed?.choices?.[0]?.finish_reason === 'stop') return 'stop';
          return null;
        },
        onDone, onError,
      });
    } catch (e) {
      if (e.name === 'AbortError') return;
      onError?.(e);
    }
  },

  /**
   * SSE streaming via Responses API (supports file/image input).
   * @param {Object} opts
   * @param {string} opts.model
   * @param {Array}  opts.input - Responses API input array
   * @param {string} opts.user
   * @param {AbortSignal} opts.signal
   * @param {Function} opts.onDelta(text)
   * @param {Function} opts.onDone(fullText)
   * @param {Function} opts.onError(err)
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
      await this._consumeSSE(res, {
        onData(parsed) {
          // Responses API events
          if (parsed?.type === 'response.output_text.delta' && parsed.delta) {
            onDelta(parsed.delta);
          } else if (parsed?.type === 'response.completed' || parsed?.type === 'response.done') {
            return 'stop';
          }
          // OpenAI compat fallback (in case proxy normalizes)
          const cd = parsed?.choices?.[0]?.delta?.content;
          if (cd) onDelta(cd);
          if (parsed?.choices?.[0]?.finish_reason === 'stop') return 'stop';
          return null;
        },
        onDone, onError,
      });
    } catch (e) {
      if (e.name === 'AbortError') return;
      onError?.(e);
    }
  },

  /** Generic SSE consumer — parses ReadableStream line-by-line */
  async _consumeSSE(response, { onData, onDone, onError }) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // incomplete line stays in buffer
        for (const line of lines) {
          const t = line.trim();
          if (!t || t.startsWith(':') || t.startsWith('event:')) continue;
          if (t === 'data: [DONE]') { onDone?.(fullText); return; }
          if (!t.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(t.slice(6));
            if (parsed.error) { onError?.(new Error(parsed.error.message || JSON.stringify(parsed.error))); return; }
            const result = onData(parsed);
            // Track cumulative text
            const d = parsed?.choices?.[0]?.delta?.content || (typeof parsed?.delta === 'string' ? parsed.delta : '');
            if (d) fullText += d;
            if (result === 'stop') { onDone?.(fullText); return; }
          } catch (_) { /* skip malformed JSON */ }
        }
      }
      // Stream ended naturally (no [DONE])
      onDone?.(fullText);
    } catch (e) {
      if (e.name !== 'AbortError') onError?.(e);
    }
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

// Monkey-patch fetch to log requests (non-intrusive)
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

  // Sanitize auth header for display
  if (logEntry.requestHeaders['Authorization']) {
    const token = logEntry.requestHeaders['Authorization'];
    logEntry.requestHeaders['Authorization'] = token.slice(0, 15) + '...' + token.slice(-6);
  }

  // Parse request body
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
    // Capture response headers
    response.headers.forEach((v, k) => { logEntry.responseHeaders[k] = v; });

    // For non-SSE responses, capture body (clone to not consume)
    if (!logEntry.isSSE && response.headers.get('content-type')?.includes('json')) {
      const clone = response.clone();
      clone.json().then(data => {
        logEntry.responseBody = data;
        RequestLog.add(logEntry);
      }).catch(() => { RequestLog.add(logEntry); });
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
