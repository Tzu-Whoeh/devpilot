/* ═══ InteractionLog v1.0 — Right Interaction Record Panel (320px) ═══
 *
 * UREQ-DEVPILOT-FE-001 D9: 对话页三栏布局 - 右侧交互记录面板
 *
 * Features:
 *   - 记录每个 Step 的详细信息
 *   - 序号、职责名称、时间戳、Prompt、Response、状态、Token消耗
 *   - 可收起/展开
 *   - 点击 Step 可展开详情
 */
const InteractionLog = {
  _steps: [],
  _expandedSteps: {},
  _collapsed: false,

  /**
   * 渲染面板HTML
   * @returns {string} HTML string
   */
  renderHTML() {
    let html = `<div class="ilog-panel ${this._collapsed ? 'collapsed' : ''}" id="ilogPanel">
      <div class="ilog-header">
        <button class="ilog-toggle-btn" id="ilogToggleBtn" onclick="InteractionLog.togglePanel()" title="${this._collapsed ? '展开记录' : '收起记录'}">
          ${this._collapsed ? '◀' : '▶'}
        </button>
        <span class="ilog-title">📋 交互记录</span>
        <span class="ilog-count" id="ilogCount">${this._steps.length}</span>
      </div>
      <div class="ilog-body" id="ilogBody">
        ${this._steps.length === 0 ? '<div class="ilog-empty">暂无交互记录<br><small>发送消息后将在此显示</small></div>' : ''}
        ${this._steps.map((step, i) => this._renderStep(step, i)).join('')}
      </div>
    </div>`;
    return html;
  },

  /**
   * 渲染单个 Step
   */
  _renderStep(step, index) {
    const expanded = this._expandedSteps[index];
    const statusIcon = {
      'pending': '⏳',
      'streaming': '🔄',
      'done': '✅',
      'error': '❌',
      'stopped': '⏹️'
    }[step.status] || '❓';

    return `
      <div class="ilog-step ${expanded ? 'expanded' : ''} ilog-step-${step.status}" data-step="${index}">
        <div class="ilog-step-header" onclick="InteractionLog.toggleStep(${index})">
          <span class="ilog-step-num">#${index + 1}</span>
          <span class="ilog-step-role">${_esc(step.roleName || 'AI')}</span>
          <span class="ilog-step-status">${statusIcon}</span>
          <span class="ilog-step-time">${this._fmtTime(step.timestamp)}</span>
        </div>
        <div class="ilog-step-detail">
          <div class="ilog-detail-section">
            <div class="ilog-detail-label">💬 Prompt</div>
            <div class="ilog-detail-content">${_esc(this._truncate(step.prompt, 200))}</div>
          </div>
          <div class="ilog-detail-section">
            <div class="ilog-detail-label">🤖 Response</div>
            <div class="ilog-detail-content">${_esc(this._truncate(step.response || '(等待中...)', 300))}</div>
          </div>
          <div class="ilog-detail-meta">
            ${step.tokens ? `<span>🎯 ${step.tokens} tokens</span>` : ''}
            ${step.duration ? `<span>⏱️ ${(step.duration / 1000).toFixed(1)}s</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 添加新的 Step 记录
   * @returns {number} step index
   */
  addStep(data) {
    const step = {
      prompt: data.prompt || '',
      response: '',
      roleName: data.roleName || 'AI',
      skillName: data.skillName || '',
      timestamp: new Date().toISOString(),
      status: 'pending',
      tokens: 0,
      duration: 0,
      startTime: Date.now()
    };
    const idx = this._steps.length;
    this._steps.push(step);
    this._refreshUI();
    return idx;
  },

  /**
   * 更新 Step 的流式内容
   */
  updateStepStream(index, delta) {
    if (!this._steps[index]) return;
    this._steps[index].response += delta;
    this._steps[index].status = 'streaming';
    // 只更新文字，不重绘整体
    const el = document.querySelector(`.ilog-step[data-step="${index}"] .ilog-detail-content:last-of-type`);
    if (el) el.textContent = this._truncate(this._steps[index].response, 300);
  },

  /**
   * 完成 Step
   */
  completeStep(index, data) {
    if (!this._steps[index]) return;
    const step = this._steps[index];
    step.status = data?.status || 'done';
    if (data?.response) step.response = data.response;
    if (data?.tokens) step.tokens = data.tokens;
    step.duration = Date.now() - step.startTime;
    this._refreshUI();
  },

  /**
   * 清空所有记录
   */
  clear() {
    this._steps = [];
    this._expandedSteps = {};
    this._refreshUI();
  },

  /**
   * 展开/收起 Step 详情
   */
  toggleStep(index) {
    this._expandedSteps[index] = !this._expandedSteps[index];
    const el = document.querySelector(`.ilog-step[data-step="${index}"]`);
    if (el) el.classList.toggle('expanded', this._expandedSteps[index]);
  },

  /**
   * 收起/展开面板
   */
  togglePanel() {
    this._collapsed = !this._collapsed;
    const panel = document.getElementById('ilogPanel');
    if (panel) panel.classList.toggle('collapsed', this._collapsed);
    const btn = document.getElementById('ilogToggleBtn');
    if (btn) btn.textContent = this._collapsed ? '◀' : '▶';
  },

  /**
   * 刷新面板UI
   */
  _refreshUI() {
    const body = document.getElementById('ilogBody');
    const count = document.getElementById('ilogCount');
    if (count) count.textContent = this._steps.length;
    if (!body) return;
    if (this._steps.length === 0) {
      body.innerHTML = '<div class="ilog-empty">暂无交互记录<br><small>发送消息后将在此显示</small></div>';
      return;
    }
    body.innerHTML = this._steps.map((step, i) => this._renderStep(step, i)).join('');
    // Auto-scroll to bottom
    body.scrollTop = body.scrollHeight;
  },

  _fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  },

  _truncate(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  }
};

window.InteractionLog = InteractionLog;
