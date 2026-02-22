/* ═══ Settings Page ═══ */
const SettingsPage = {
  render() {
    Shell.setBreadcrumb([{ label: '⚙️ 设置', path: '/settings' }]);
    const user = AppState.user || {};
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
                <p>自由对话记录 ${(AppState.get('free_chat',[]).length)} 条消息</p>
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
  },

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
    AppState.set('free_chat', []);
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
