/* ═══ Settings Page ═══ */
const SettingsPage = {
  _aiConfig: null,
  _isAdmin: false,

  async render() {
    Shell.setBreadcrumb([{ label: '⚙️ 设置', path: '/settings' }]);
    const user = AppState.user || {};
    this._isAdmin = user.role === 'admin';

    // Count chat sessions
    const sessions = AppState.get('chat_sessions', {});
    const sessionCount = Object.keys(sessions).length;
    const msgCount = Object.values(sessions).reduce((sum, s) => sum + (s.messages?.length || 0), 0);

    Shell.setContent(`
      <div class="page-container">
        <div class="settings-page">
          <h2 style="margin-bottom:var(--space-xl)">设置</h2>

          <div class="settings-section">
            <h3>👤 用户信息</h3>
            <div class="setting-row">
              <div class="setting-info"><h4>用户名</h4><p>${_esc(user.username || 'N/A')}</p></div>
            </div>
            <div class="setting-row">
              <div class="setting-info"><h4>邮箱</h4><p>${_esc(user.email || 'N/A')}</p></div>
            </div>
            <div class="setting-row">
              <div class="setting-info"><h4>角色</h4><p>${_esc(user.role || 'user')}</p></div>
            </div>
          </div>

          <div class="settings-section">
            <h3>🔌 服务连接</h3>
            <div class="setting-row">
              <div class="setting-info">
                <h4>Mock 模式</h4>
                <p>开启后使用本地模拟数据，无需后端服务</p>
              </div>
              <label class="toggle">
                <input type="checkbox" ${CONFIG.USE_MOCK ? 'checked' : ''} onchange="SettingsPage.toggleMock(this.checked)">
                <div class="toggle-track"></div>
              </label>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <h4>后端服务地址</h4>
                <p>Auth / PCC Core API 地址</p>
              </div>
              <div>
                <input class="input" style="width:240px" value="${_esc(CONFIG.BASE_URL || '')}"
                  placeholder="默认: 当前域名" onchange="SettingsPage.setBaseUrl(this.value)">
              </div>
            </div>
          </div>

          ${this._isAdmin ? `
          <div class="settings-section" id="aiConfigSection">
            <h3>🤖 大模型配置 <span style="font-size:11px;color:var(--accent);font-weight:normal">(管理员)</span></h3>
            <div id="aiConfigContent">
              <div class="setting-row"><div class="setting-info"><p style="color:var(--text-dim)">加载中...</p></div></div>
            </div>
          </div>
          ` : ''}

          <div class="settings-section">
            <h3>📊 数据管理</h3>
            <div class="setting-row">
              <div class="setting-info">
                <h4>本地项目数据</h4>
                <p>当前有 ${AppState.projects.length} 个项目存储在浏览器中</p>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <h4>对话历史</h4>
                <p>${sessionCount} 个会话, ${msgCount} 条消息</p>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="SettingsPage.clearChat()">清空对话</button>
            </div>
          </div>

          <div class="settings-danger">
            <h3 style="color:var(--error)">⚠️ 危险操作</h3>
            <div class="setting-row">
              <div class="setting-info">
                <h4>清除所有数据</h4>
                <p>删除所有本地项目、对话、设置数据（不可恢复）</p>
              </div>
              <button class="btn btn-danger btn-sm" onclick="SettingsPage.clearAll()">清除所有数据</button>
            </div>
          </div>
        </div>
      </div>
    `);

    // Load AI config if admin
    if (this._isAdmin) this._loadAIConfig();
  },

  // ── AI Config (admin) ──
  async _loadAIConfig() {
    const el = document.getElementById('aiConfigContent');
    if (!el) return;
    try {
      this._aiConfig = await API.getAIConfig();
      this._renderAIConfig(el);
    } catch (e) {
      el.innerHTML = `<div class="setting-row"><div class="setting-info">
        <p style="color:var(--error)">加载失败: ${_esc(e.message)}</p>
      </div></div>`;
    }
  },

  _renderAIConfig(el) {
    const c = this._aiConfig;
    el.innerHTML = `
      <div class="setting-row">
        <div class="setting-info">
          <h4>AI Gateway 地址</h4>
          <p>ClawAPI 服务器地址（后端代理目标）</p>
        </div>
        <div>
          <input class="input" id="aiConfigUrl" style="width:300px" value="${_esc(c.clawapi_url || '')}"
            placeholder="http://127.0.0.1:16002">
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <h4>API Key</h4>
          <p>ClawAPI 认证密钥 ${c.clawapi_key_set ? `<span style="color:var(--success)">（已配置: ${_esc(c.clawapi_key_preview)}）</span>` : '<span style="color:var(--warning)">（未配置）</span>'}</p>
        </div>
        <div>
          <input class="input" id="aiConfigKey" type="password" style="width:300px" value=""
            placeholder="${c.clawapi_key_set ? '留空保持不变，输入新值覆盖' : '输入 API Key'}">
        </div>
      </div>
      <div class="setting-row" style="justify-content:flex-end;gap:var(--space-sm)">
        <button class="btn btn-ghost btn-sm" onclick="SettingsPage.testAIConnection()" id="aiTestBtn">🔍 测试连接</button>
        <button class="btn btn-primary btn-sm" onclick="SettingsPage.saveAIConfig()" id="aiSaveBtn">💾 保存</button>
      </div>
      <div id="aiTestResult"></div>
    `;
  },

  async saveAIConfig() {
    const url = document.getElementById('aiConfigUrl')?.value?.trim();
    const key = document.getElementById('aiConfigKey')?.value;
    const btn = document.getElementById('aiSaveBtn');

    const data = {};
    if (url !== undefined) data.clawapi_url = url;
    if (key) data.clawapi_key = key; // only send if non-empty

    if (!Object.keys(data).length) {
      Shell.toast('没有更改', 'info');
      return;
    }

    btn && (btn.disabled = true, btn.textContent = '保存中...');
    try {
      const result = await API.updateAIConfig(data);
      Shell.toast(
        result.changed?.length
          ? `已更新: ${result.changed.join(', ')}${result.clawapi_connected ? '' : ' (连接失败，请检查配置)'}`
          : '配置未变更',
        result.clawapi_connected ? 'success' : 'warning'
      );
      // Refresh
      this._loadAIConfig();
    } catch (e) {
      Shell.toast('保存失败: ' + e.message, 'error');
    } finally {
      btn && (btn.disabled = false, btn.textContent = '💾 保存');
    }
  },

  async testAIConnection() {
    const btn = document.getElementById('aiTestBtn');
    const resultEl = document.getElementById('aiTestResult');
    btn && (btn.disabled = true, btn.textContent = '测试中...');

    try {
      const r = await API.testAIConfig();
      let html = '<div class="ai-test-result">';
      html += `<div class="ai-test-row ${r.health_ok ? 'ok' : 'err'}">
        <span>${r.health_ok ? '✅' : '❌'} 健康检查</span>
        <span>${r.health_ok ? 'HTTP ' + r.health_status : _esc(r.health_error || '连接失败')}</span>
      </div>`;
      if (r.agents_ok !== undefined) {
        html += `<div class="ai-test-row ${r.agents_ok ? 'ok' : 'err'}">
          <span>${r.agents_ok ? '✅' : '❌'} Agent 列表</span>
          <span>${r.agents_ok ? r.agents?.join(', ') || 'OK' : _esc(r.agents_error || 'HTTP ' + r.agents_status)}</span>
        </div>`;
      }
      if (!r.clawapi_key_set) {
        html += `<div class="ai-test-row err"><span>⚠️ API Key 未配置</span><span>Agent 无法调用</span></div>`;
      }
      html += '</div>';
      resultEl && (resultEl.innerHTML = html);
    } catch (e) {
      resultEl && (resultEl.innerHTML = `<div class="ai-test-result"><div class="ai-test-row err">
        <span>❌ 测试失败</span><span>${_esc(e.message)}</span>
      </div></div>`);
    } finally {
      btn && (btn.disabled = false, btn.textContent = '🔍 测试连接');
    }
  },

  // ── Other actions ──
  toggleMock(checked) {
    CONFIG.USE_MOCK = checked;
    AppState.set('use_mock', checked);
    Shell.toast(checked ? 'Mock 模式已开启' : 'Mock 模式已关闭，将使用后端服务', 'info');
  },

  setBaseUrl(url) {
    CONFIG.BASE_URL = url.replace(/\/+$/, '');
    AppState.set('base_url', CONFIG.BASE_URL);
    Shell.toast('服务地址已更新', 'success');
  },

  clearChat() {
    AppState.remove('chat_sessions');
    AppState.remove('chat_active');
    AppState.remove('chat_expanded');
    AppState.remove('free_chat');
    if (typeof ChatPage !== 'undefined') {
      ChatPage._sessions = {};
      ChatPage._activeSession = null;
      Shell.renderChatTree();
    }
    Shell.toast('对话历史已清空', 'info');
    this.render();
  },

  clearAll() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复。')) return;
    AppState.clear();
    Shell.toast('所有数据已清除', 'info');
    Router.navigate('/login');
  }
};
window.SettingsPage = SettingsPage;
