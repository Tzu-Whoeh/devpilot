/* ═══ Debug Page — Request/Response Inspector ═══ */
const DebugPage = {
  _unsubscribe: null,
  _selectedId: null,
  _filter: '',

  render() {
    Shell.setBreadcrumb([{ label: '🔧 调试', path: '/debug' }]);
    Shell.setContent(`
      <div class="debug-page">
        <div class="debug-toolbar">
          <h2>🔧 请求调试面板</h2>
          <div class="debug-toolbar-actions">
            <input type="text" class="debug-filter" id="debugFilter" placeholder="过滤 URL..."
              oninput="DebugPage.setFilter(this.value)">
            <button class="debug-clear-btn" onclick="DebugPage.clearAll()">🗑 清空</button>
          </div>
        </div>
        <div class="debug-body">
          <div class="debug-list-panel" id="debugList"></div>
          <div class="debug-detail-panel" id="debugDetail">
            <div class="debug-detail-empty">← 选择一条请求查看详情</div>
          </div>
        </div>
      </div>
    `);
    this._renderList();
    // Subscribe to new entries
    this._unsubscribe = RequestLog.onEntry(() => this._renderList());
  },

  destroy() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
  },

  setFilter(v) {
    this._filter = v.toLowerCase();
    this._renderList();
  },

  clearAll() {
    RequestLog.clear();
    this._selectedId = null;
    this._renderList();
    this._renderDetail(null);
  },

  _renderList() {
    const el = document.getElementById('debugList');
    if (!el) return;
    let entries = RequestLog.getAll();
    if (this._filter) {
      entries = entries.filter(e => e.url.toLowerCase().includes(this._filter) || (e.method||'').toLowerCase().includes(this._filter));
    }
    if (!entries.length) {
      el.innerHTML = '<div class="debug-list-empty">暂无请求记录</div>';
      return;
    }
    el.innerHTML = entries.map(e => {
      const statusClass = e.error ? 'err' : (e.status >= 400 ? 'err' : (e.status >= 300 ? 'warn' : 'ok'));
      const shortUrl = e.url.replace(window.location.origin, '');
      const active = e.id === this._selectedId ? 'active' : '';
      return `<div class="debug-list-item ${statusClass} ${active}" onclick="DebugPage.select('${e.id}')">
        <span class="debug-method ${e.method.toLowerCase()}">${e.method}</span>
        <span class="debug-url">${_esc(shortUrl)}</span>
        <span class="debug-status">${e.error ? 'ERR' : (e.status || '...')}</span>
        <span class="debug-duration">${e.duration}ms</span>
        ${e.isSSE ? '<span class="debug-tag-sse">SSE</span>' : ''}
      </div>`;
    }).join('');
  },

  select(id) {
    this._selectedId = id;
    const entry = RequestLog.getAll().find(e => e.id === id);
    this._renderDetail(entry);
    // Highlight in list
    document.querySelectorAll('.debug-list-item').forEach(el => {
      el.classList.toggle('active', el.onclick?.toString().includes(id));
    });
    this._renderList(); // re-render to update active state
  },

  _renderDetail(entry) {
    const el = document.getElementById('debugDetail');
    if (!el) return;
    if (!entry) {
      el.innerHTML = '<div class="debug-detail-empty">← 选择一条请求查看详情</div>';
      return;
    }
    const statusClass = entry.error ? 'err' : (entry.status >= 400 ? 'err' : 'ok');
    el.innerHTML = `
      <div class="debug-detail-header">
        <span class="debug-method ${entry.method.toLowerCase()}">${entry.method}</span>
        <span class="debug-detail-url">${_esc(entry.url)}</span>
        <span class="debug-detail-status ${statusClass}">${entry.error ? 'ERROR' : entry.status} ${entry.statusText || ''}</span>
        <span class="debug-detail-time">${entry.duration}ms</span>
      </div>
      <div class="debug-detail-ts">${entry.timestamp}</div>

      <div class="debug-section">
        <div class="debug-section-title" onclick="this.parentElement.classList.toggle('collapsed')">▼ 请求头</div>
        <pre class="debug-json">${_esc(JSON.stringify(entry.requestHeaders, null, 2))}</pre>
      </div>

      ${entry.requestBody ? `
      <div class="debug-section">
        <div class="debug-section-title" onclick="this.parentElement.classList.toggle('collapsed')">▼ 请求体</div>
        <pre class="debug-json">${_esc(typeof entry.requestBody === 'string' ? entry.requestBody : JSON.stringify(entry.requestBody, null, 2))}</pre>
      </div>` : ''}

      <div class="debug-section">
        <div class="debug-section-title" onclick="this.parentElement.classList.toggle('collapsed')">▼ 响应头</div>
        <pre class="debug-json">${_esc(JSON.stringify(entry.responseHeaders, null, 2))}</pre>
      </div>

      ${entry.responseBody ? `
      <div class="debug-section">
        <div class="debug-section-title" onclick="this.parentElement.classList.toggle('collapsed')">▼ 响应体</div>
        <pre class="debug-json">${_esc(typeof entry.responseBody === 'string' ? entry.responseBody : JSON.stringify(entry.responseBody, null, 2))}</pre>
      </div>` : ''}

      ${entry.error ? `
      <div class="debug-section">
        <div class="debug-section-title err">▼ 错误</div>
        <pre class="debug-json err">${_esc(entry.error)}</pre>
      </div>` : ''}
    `;
  },
};

window.DebugPage = DebugPage;
