/* ═══ New Project Wizard — 3 Steps ═══ */
const WizardPage = {
  _step: 1,
  _selectedType: null,
  _phases: [],
  _projectName: '',
  _projectDesc: '',

  async render(params) {
    Shell.setBreadcrumb([
      { label: '📊 项目总览', path: '/' },
      { label: '✨ 新建项目', path: '/new' }
    ]);

    // Check if type pre-selected from URL
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const preType = urlParams.get('type');
    if (preType && MOCK_TEMPLATES[preType]) {
      this._selectedType = MOCK_TEMPLATES[preType];
      this._phases = [...this._selectedType.phases];
      this._step = 2;
    } else {
      this._step = 1;
      this._selectedType = null;
    }

    this._render();
  },

  _render() {
    Shell.setContent(`
      <div class="page-container">
        <div class="wizard">
          ${this._renderProgress()}
          ${this._step === 1 ? this._renderStep1() : ''}
          ${this._step === 2 ? this._renderStep2() : ''}
          ${this._step === 3 ? this._renderStep3() : ''}
        </div>
      </div>
    `);
  },

  _renderProgress() {
    return `
      <div class="wizard-progress">
        <div class="wiz-step ${this._step >= 1 ? (this._step > 1 ? 'done' : 'active') : ''}">
          <div class="wiz-dot">${this._step > 1 ? '✓' : '1'}</div>
          <span>选择类型</span>
        </div>
        <div class="wiz-line"></div>
        <div class="wiz-step ${this._step >= 2 ? (this._step > 2 ? 'done' : 'active') : ''}">
          <div class="wiz-dot">${this._step > 2 ? '✓' : '2'}</div>
          <span>确认流程</span>
        </div>
        <div class="wiz-line"></div>
        <div class="wiz-step ${this._step >= 3 ? 'active' : ''}">
          <div class="wiz-dot">3</div>
          <span>命名启动</span>
        </div>
      </div>
    `;
  },

  _renderStep1() {
    const types = Object.values(MOCK_TEMPLATES);
    return `
      <div class="wiz-title">选择任务类型</div>
      <div class="wiz-subtitle">选择你要开始的项目类型，系统将为你提供标准工作流程</div>
      <div class="type-cards">
        ${types.map(t => `
          <div class="type-card card-interactive" onclick="WizardPage.selectType('${t.type_key}')">
            <div class="type-card-icon">${t.icon}</div>
            <div class="type-card-name">${t.name}</div>
            <div class="type-card-desc">${t.description}</div>
            <div class="type-card-phases">${t.phase_count} 个阶段</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  _renderStep2() {
    if (!this._selectedType) return '';
    return `
      <div class="wiz-title">${this._selectedType.icon} ${this._selectedType.name} — 标准工作流程</div>
      <div class="wiz-subtitle">以下是系统推荐的阶段流程，每个阶段由 AI 自动执行，你只需审批</div>
      <div class="phase-timeline">
        ${this._phases.map((ph, i) => `
          <div class="pt-item">
            <div class="pt-dot">${ph.icon}</div>
            <div class="pt-content">
              <div class="pt-header">
                <span class="pt-name">${ph.name}</span>
                <span class="pt-role">@${ph.role}</span>
              </div>
              <div class="pt-desc">${ph.desc}</div>
              <div class="pt-detail">
                🤖 AI: ${ph.ai_action}<br>
                👤 你: ${ph.user_action}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="wiz-actions">
        <button class="btn btn-secondary" onclick="WizardPage.back()">← 返回</button>
        <button class="btn btn-primary btn-lg" onclick="WizardPage.toStep3()">确认流程 →</button>
      </div>
    `;
  },

  _renderStep3() {
    return `
      <div class="wiz-title">命名你的项目</div>
      <div class="wiz-subtitle">给项目取一个名字，然后启动吧！</div>
      <div class="wiz-form">
        <div class="field">
          <label class="field-label">项目名称 *</label>
          <input class="input" id="wizName" placeholder="例如：MyApp、产品宣传片、朝阳区新店" value="${_esc(this._projectName)}" autofocus>
        </div>
        <div class="field">
          <label class="field-label">简要描述（可选）</label>
          <textarea class="input textarea" id="wizDesc" placeholder="简单描述你的项目目标">${_esc(this._projectDesc)}</textarea>
        </div>
      </div>
      <div class="wiz-actions">
        <button class="btn btn-secondary" onclick="WizardPage.backToStep2()">← 返回</button>
        <button class="btn btn-primary btn-lg" onclick="WizardPage.launch()" id="launchBtn">
          🚀 启动项目
        </button>
      </div>
    `;
  },

  selectType(typeKey) {
    this._selectedType = MOCK_TEMPLATES[typeKey];
    this._phases = [...this._selectedType.phases];
    this._step = 2;
    this._render();
  },

  back() {
    this._step = 1;
    this._selectedType = null;
    this._render();
  },

  toStep3() {
    this._step = 3;
    this._render();
    setTimeout(() => document.getElementById('wizName')?.focus(), 100);
  },

  backToStep2() {
    this._step = 2;
    this._render();
  },

  async launch() {
    const name = document.getElementById('wizName')?.value?.trim();
    const desc = document.getElementById('wizDesc')?.value?.trim();
    if (!name) {
      Shell.toast('请输入项目名称', 'error');
      document.getElementById('wizName')?.focus();
      return;
    }

    const btn = document.getElementById('launchBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 创建中...';

    try {
      const project = await API.createProject({
        type_key: this._selectedType.type_key,
        name,
        description: desc
      });
      Shell.toast(`项目「${name}」创建成功！`, 'success');
      Router.navigate('/projects/' + project.id);
    } catch(err) {
      Shell.toast('创建失败: ' + err.message, 'error');
      btn.disabled = false; btn.innerHTML = '🚀 启动项目';
    }
  }
};
window.WizardPage = WizardPage;
