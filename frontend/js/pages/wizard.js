/* ═══ New Project Wizard v3.0 — 2-Step + AI Interview Pipeline ═══
 *
 * Flow:
 *   Step 1: 选择任务类型
 *   Step 2: 命名启动 → 创建项目
 *   Phase A: AI-PM 项目启动访谈（3-5轮）→ 启动报告 → 确认
 *   Phase B: AI-BA 需求分析访谈（3-8轮）→ 生成初步需求摘要
 *   Phase C: 需求摘要多角色 Review（AI-Arch/AI-QA/AI-PM）→ 展示结果 → 确认
 *
 * Uses existing ClawAPI chat infrastructure (API.streamChat) with
 * role-specific session keys for conversation context.
 */
const WizardPage = {
  // ── Wizard State ──
  _step: 1,
  _selectedType: null,
  _phases: [],
  _projectName: '',
  _projectDesc: '',

  // ── Interview State ──
  _projectId: null,
  _phase: null,         // 'pm_interview' | 'ba_interview' | 'prd_review'
  _pmMessages: [],
  _baMessages: [],
  _pmReport: null,      // AI-PM generated report text
  _prdContent: null,    // AI-BA generated PRD text
  _reviewResults: {},   // { 'AI-Arch': {...}, 'AI-QA': {...}, 'AI-PM': {...} }
  _sending: false,
  _abortCtrl: null,
  _pmRound: 0,
  _baRound: 0,

  // ── PM Interview System Prompt ──
  _pmSystemPrompt(typeName, projName, projDesc) {
    return `你是 AI-PM（AI项目经理），正在为一个新项目进行启动访谈。

项目类型：${typeName}
项目名称：${projName}
项目描述：${projDesc || '（用户未提供详细描述）'}

你的任务：
1. 通过 3-5 轮对话，了解项目的基本信息
2. 你需要问以下方面的问题（每轮 1-2 个问题，不要一次全问）：
   - 项目目标和预期成果
   - 目标用户/受众
   - 时间要求和里程碑
   - 预算和资源约束
   - 已有条件和技术选型偏好
   - 特殊要求或约束
3. 根据用户回答调整后续问题
4. 当你觉得信息足够时（通常 3-5 轮后），生成一份项目启动报告

项目启动报告格式要求：
当你准备生成报告时，用以下标记包裹：
[PROJECT_REPORT_START]
# 项目启动报告

## 项目概述
（概述信息）

## 目标与范围
（目标和范围）

## 目标用户
（用户画像）

## 时间规划
（里程碑和时间线）

## 资源与约束
（资源、预算、约束条件）

## 风险识别
（初步风险识别）

## 建议与下一步
（建议和下一步行动）
[PROJECT_REPORT_END]

现在开始第一轮访谈。请用友好、专业的语气进行提问。每次回复简洁有力，不要太长。`;
  },

  // ── BA Interview System Prompt ──
  _baSystemPrompt(typeName, projName, projDesc, pmReport) {
    return `你是 AI-BA（AI业务分析师），正在为一个项目进行需求分析访谈。

项目类型：${typeName}
项目名称：${projName}
项目描述：${projDesc || '（无详细描述）'}

以下是 AI-PM 的项目启动报告供你参考：
---
${pmReport}
---

你的任务：
1. 基于项目启动报告，进行 3-8 轮深入的需求访谈
2. 你需要逐步挖掘以下内容：
   - 核心功能需求（分优先级 P0/P1/P2）
   - 用户故事和使用场景
   - 非功能需求（性能、安全、可用性）
   - 数据需求和集成要求
   - UI/UX 偏好和参考
   - 验收标准
3. 每轮问 1-2 个具体问题，逐步深入
4. 当需求信息充分时，生成初步需求摘要文档

初步需求摘要生成格式要求：
当你准备生成需求摘要时，用以下标记包裹：
[REQUIREMENTS_SUMMARY_START]
# 初步需求摘要

## 1. 产品概述
（产品定义、愿景、目标）

## 2. 目标用户
（用户画像、用户场景）

## 3. 功能需求
### 3.1 P0 — 核心功能（必须）
（核心功能列表和详细描述）

### 3.2 P1 — 重要功能（应该有）
（重要功能列表）

### 3.3 P2 — 增强功能（可以有）
（增强功能列表）

## 4. 非功能需求
（性能、安全、可用性、兼容性要求）

## 5. 数据需求
（数据模型、存储、接口要求）

## 6. UI/UX 要求
（界面设计原则、参考、关键页面描述）

## 7. 验收标准
（每个核心功能的验收条件）

## 8. 约束与假设
（技术约束、业务假设、依赖项）

## 9. 附录
（术语表、参考资料）
[REQUIREMENTS_SUMMARY_END]

现在开始需求分析访谈。基于项目启动报告，你已经有了基本了解，直接问更深入的需求问题。每次回复简洁有力。`;
  },

  // ── Review Prompts ──
  _reviewPrompt(role, prdContent) {
    const roleGuides = {
      'AI-Arch': {
        focus: '技术架构可行性',
        points: '技术选型合理性、架构风险、系统集成复杂度、性能瓶颈、可扩展性、技术债务风险',
      },
      'AI-QA': {
        focus: '质量保障与可测试性',
        points: '验收标准完整性、测试覆盖可行性、边界条件考虑、异常场景覆盖、非功能需求可验证性',
      },
      'AI-PM': {
        focus: '项目管理与需求完整性',
        points: '需求完整性与一致性、排期合理性、资源依赖识别、范围蔓延风险、优先级划分合理性',
      },
    };
    const guide = roleGuides[role];
    return `你是 ${role}，请从「${guide.focus}」角度审查以下初步需求摘要文档。

审查要点：${guide.points}

需求摘要内容如下：
---
${prdContent}
---

请给出你的审查意见，格式如下（严格使用 JSON，不要用 markdown 代码块包裹）：
{"conclusion":"通过|有风险|需补充","summary":"一句话总结你的审查结论","details":["具体意见1","具体意见2","具体意见3"]}

只输出 JSON，不要有其他内容。`;
  },

  // ══════════════════════════════════════════════════════
  //  RENDER ENTRY
  // ══════════════════════════════════════════════════════
  async render(params) {
    Shell.setBreadcrumb([
      { label: '📊 项目总览', path: '/' },
      { label: '✨ 新建项目', path: '/new' }
    ]);

    // Check URL params
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const preType = urlParams.get('type');
    if (preType && MOCK_TEMPLATES[preType]) {
      this._selectedType = MOCK_TEMPLATES[preType];
      this._phases = [...this._selectedType.phases];
      this._step = 2;
    } else if (!this._phase) {
      this._step = 1;
      this._selectedType = null;
    }

    this._render();
  },

  _render() {
    if (this._phase) {
      this._renderInterviewPhase();
      return;
    }
    Shell.setContent(`
      <div class="page-container">
        <div class="wizard">
          ${this._renderProgress()}
          ${this._step === 1 ? this._renderStep1() : ''}
          ${this._step === 2 ? this._renderStep2() : ''}
        </div>
      </div>
    `);
  },

  // ── Progress Bar (2-step) ──
  _renderProgress() {
    return `
      <div class="wizard-progress">
        <div class="wiz-step ${this._step >= 1 ? (this._step > 1 ? 'done' : 'active') : ''}">
          <div class="wiz-dot">${this._step > 1 ? '✓' : '1'}</div>
          <span>选择类型</span>
        </div>
        <div class="wiz-line"></div>
        <div class="wiz-step ${this._step >= 2 ? 'active' : ''}">
          <div class="wiz-dot">2</div>
          <span>命名启动</span>
        </div>
      </div>
    `;
  },

  // ── Step 1: Type Selection ──
  _renderStep1() {
    const types = Object.values(MOCK_TEMPLATES);
    return `
      <div class="wiz-title">选择任务类型</div>
      <div class="wiz-subtitle">选择你要开始的项目类型，系统将为你提供 AI 协作工作流</div>
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

  // ── Step 2: Naming (直接启动，不再有 Step 3) ──
  _renderStep2() {
    return `
      <div class="wiz-title">命名你的项目</div>
      <div class="wiz-subtitle">给项目取一个名字，AI 团队将开始协作启动流程</div>
      <div class="wiz-form">
        <div class="field">
          <label class="field-label">项目名称 *</label>
          <input class="input" id="wizName" placeholder="例如：MyApp、产品宣传片、朝阳区新店" value="${_esc(this._projectName)}" autofocus>
        </div>
        <div class="field">
          <label class="field-label">简要描述（可选）</label>
          <textarea class="input textarea" id="wizDesc" placeholder="简单描述你的项目目标和需求">${_esc(this._projectDesc)}</textarea>
        </div>
      </div>
      <div class="wiz-actions">
        <button class="btn btn-secondary" onclick="WizardPage.back()">← 返回</button>
        <button class="btn btn-primary btn-lg" onclick="WizardPage.launch()" id="launchBtn">
          🚀 启动项目
        </button>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════
  //  INTERVIEW PHASE RENDERING
  // ══════════════════════════════════════════════════════
  _renderInterviewPhase() {
    Shell.setBreadcrumb([
      { label: '📊 项目总览', path: '/' },
      { label: '✨ 新建项目', path: '/new' },
      { label: `📋 ${this._projectName}`, path: '' }
    ]);

    const phaseIndex = this._phase === 'pm_interview' ? 0
      : this._phase === 'ba_interview' ? 1 : 2;

    Shell.setContent(`
      <div class="page-container">
        <div class="interview-container">
          ${this._renderPhaseProgress(phaseIndex)}
          <div class="interview-body" id="interviewBody">
            ${this._phase === 'pm_interview' ? this._renderPMInterview() : ''}
            ${this._phase === 'ba_interview' ? this._renderBAInterview() : ''}
            ${this._phase === 'prd_review' ? this._renderPRDReview() : ''}
          </div>
        </div>
      </div>
    `);

    this._scrollInterviewBottom();
    setTimeout(() => document.getElementById('interviewInput')?.focus(), 100);
  },

  _renderPhaseProgress(activeIndex) {
    const phases = [
      { icon: '📋', label: 'AI-PM 项目访谈' },
      { icon: '📊', label: 'AI-BA 需求分析' },
      { icon: '🔍', label: '需求摘要多角色审查' },
    ];
    return `
      <div class="interview-progress">
        ${phases.map((p, i) => `
          <div class="ip-step ${i < activeIndex ? 'done' : (i === activeIndex ? 'active' : '')}">
            <div class="ip-dot">${i < activeIndex ? '✓' : p.icon}</div>
            <span>${p.label}</span>
          </div>
          ${i < phases.length - 1 ? '<div class="ip-line"></div>' : ''}
        `).join('')}
      </div>
    `;
  },

  // ── PM Interview View ──
  _renderPMInterview() {
    const hasReport = !!this._pmReport;
    return `
      <div class="interview-header">
        <div class="interview-header-icon">📋</div>
        <div>
          <div class="interview-header-title">AI-PM 项目启动访谈</div>
          <div class="interview-header-sub">AI 项目经理将了解你的项目基本信息，生成启动报告</div>
        </div>
      </div>
      <div class="interview-messages" id="interviewMessages">
        ${this._pmMessages.map(m => this._renderMessage(m)).join('')}
        ${this._sending ? '<div class="interview-typing" id="interviewTyping"><div class="typing-dots"><span></span><span></span><span></span></div></div>' : ''}
      </div>
      ${hasReport ? this._renderReportConfirm() : this._renderInputArea('pm')}
    `;
  },

  // ── BA Interview View ──
  _renderBAInterview() {
    const hasPRD = !!this._prdContent;
    return `
      <div class="interview-header">
        <div class="interview-header-icon">📊</div>
        <div>
          <div class="interview-header-title">AI-BA 需求分析访谈</div>
          <div class="interview-header-sub">AI 业务分析师将深入挖掘需求细节，生成初步需求摘要</div>
        </div>
      </div>
      <div class="interview-messages" id="interviewMessages">
        ${this._baMessages.map(m => this._renderMessage(m)).join('')}
        ${this._sending ? '<div class="interview-typing" id="interviewTyping"><div class="typing-dots"><span></span><span></span><span></span></div></div>' : ''}
      </div>
      ${hasPRD ? this._renderPRDConfirm() : this._renderInputArea('ba')}
    `;
  },

  // ── PRD Review View ──
  _renderPRDReview() {
    const roles = ['AI-Arch', 'AI-QA', 'AI-PM'];
    const allDone = roles.every(r => this._reviewResults[r]);
    const icons = { 'AI-Arch': '🏗️', 'AI-QA': '✅', 'AI-PM': '📋' };
    const labels = { 'AI-Arch': 'AI 架构师', 'AI-QA': 'AI 测试', 'AI-PM': 'AI 项目经理' };
    const conclusionClass = { '通过': 'review-pass', '有风险': 'review-risk', '需补充': 'review-need' };

    return `
      <div class="interview-header">
        <div class="interview-header-icon">🔍</div>
        <div>
          <div class="interview-header-title">需求摘要多角色审查</div>
          <div class="interview-header-sub">AI-Arch / AI-QA / AI-PM 三角色并行审查初步需求摘要</div>
        </div>
      </div>
      <div class="review-content">
        <div class="review-prd-preview">
          <div class="review-prd-title">📄 初步需求摘要预览</div>
          <div class="review-prd-body">${this._renderMarkdown(this._prdContent || '')}</div>
        </div>
        <div class="review-cards">
          ${roles.map(role => {
            const result = this._reviewResults[role];
            if (!result) {
              return `
                <div class="review-card review-loading">
                  <div class="review-card-header">
                    <span class="review-card-icon">${icons[role]}</span>
                    <span class="review-card-role">${labels[role]}</span>
                  </div>
                  <div class="review-card-body">
                    <div class="typing-dots"><span></span><span></span><span></span></div>
                    <span class="review-loading-text">正在审查...</span>
                  </div>
                </div>`;
            }
            const cc = conclusionClass[result.conclusion] || 'review-risk';
            return `
              <div class="review-card ${cc}">
                <div class="review-card-header">
                  <span class="review-card-icon">${icons[role]}</span>
                  <span class="review-card-role">${labels[role]}</span>
                  <span class="review-conclusion-tag ${cc}">${_esc(result.conclusion)}</span>
                </div>
                <div class="review-card-summary">${_esc(result.summary)}</div>
                <div class="review-card-details">
                  ${(result.details || []).map(d => `<div class="review-detail-item">• ${_esc(d)}</div>`).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>
        ${allDone ? `
          <div class="review-actions">
            <button class="btn btn-primary btn-lg" onclick="WizardPage.confirmPRD()">
              ✅ 确认需求摘要，进入项目
            </button>
            <button class="btn btn-secondary" onclick="WizardPage.revisePRD()">
              🔄 让 AI-BA 修改需求摘要
            </button>
          </div>
        ` : ''}
      </div>
    `;
  },

  // ── Message Rendering ──
  _renderMessage(msg) {
    const isAI = msg.role === 'ai';
    const icon = isAI ? (msg.icon || '🤖') : '👤';
    const label = isAI ? (msg.sender || 'AI') : '你';
    const content = isAI ? this._renderMarkdown(msg.text) : _esc(msg.text);
    return `
      <div class="interview-msg ${isAI ? 'ai' : 'user'}">
        <div class="interview-msg-avatar">${icon}</div>
        <div class="interview-msg-body">
          <div class="interview-msg-sender">${label}</div>
          <div class="interview-msg-content">${content}</div>
        </div>
      </div>
    `;
  },

  // ── Input Area ──
  _renderInputArea(phase) {
    const round = phase === 'pm' ? this._pmRound : this._baRound;
    const canGenerate = phase === 'ba' && round >= 2;
    return `
      <div class="interview-input-area">
        <div class="interview-input-wrap">
          <textarea id="interviewInput" class="interview-input" placeholder="输入你的回答..." rows="1"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();WizardPage.sendMessage('${phase}')}"
            oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"
            ${this._sending ? 'disabled' : ''}></textarea>
          <button class="interview-send-btn" onclick="WizardPage.sendMessage('${phase}')" ${this._sending ? 'disabled' : ''}>
            ${this._sending ? '<span class="spinner-sm"></span>' : '发送'}
          </button>
        </div>
        ${canGenerate ? `
          <button class="btn btn-accent interview-generate-btn" onclick="WizardPage.requestGenerate('${phase}')">
            ✨ 信息足够了，生成 ${phase === 'ba' ? '需求摘要' : '报告'}
          </button>
        ` : ''}
      </div>
    `;
  },

  // ── Report Confirm ──
  _renderReportConfirm() {
    return `
      <div class="interview-report">
        <div class="interview-report-title">📋 项目启动报告</div>
        <div class="interview-report-body">${this._renderMarkdown(this._pmReport)}</div>
        <div class="interview-report-actions">
          <button class="btn btn-primary btn-lg" onclick="WizardPage.confirmReport()">
            ✅ 确认报告，开始需求分析
          </button>
          <button class="btn btn-secondary" onclick="WizardPage.reviseReport()">
            🔄 需要补充修改
          </button>
        </div>
      </div>
    `;
  },

  // ── PRD Confirm (before review) ──
  _renderPRDConfirm() {
    return `
      <div class="interview-report">
        <div class="interview-report-title">📄 初步需求摘要</div>
        <div class="interview-report-body">${this._renderMarkdown(this._prdContent)}</div>
        <div class="interview-report-actions">
          <button class="btn btn-primary btn-lg" onclick="WizardPage.startReview()">
            🔍 提交多角色审查
          </button>
          <button class="btn btn-secondary" onclick="WizardPage.revisePRDBeforeReview()">
            🔄 继续补充需求
          </button>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════
  //  WIZARD ACTIONS
  // ══════════════════════════════════════════════════════
  selectType(typeKey) {
    this._selectedType = MOCK_TEMPLATES[typeKey];
    this._phases = [...this._selectedType.phases];
    this._step = 2;
    this._render();
    setTimeout(() => document.getElementById('wizName')?.focus(), 100);
  },

  back() {
    this._step = 1;
    this._selectedType = null;
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

    this._projectName = name;
    this._projectDesc = desc || '';

    const btn = document.getElementById('launchBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 创建中...';

    try {
      // Create project (mock or real)
      const project = await API.createProject({
        type_key: this._selectedType.type_key,
        name,
        description: desc
      });
      this._projectId = project.id;

      Shell.toast(`项目「${name}」创建成功！AI-PM 即将开始访谈...`, 'success');

      // Transition to PM interview
      this._phase = 'pm_interview';
      this._pmMessages = [];
      this._pmRound = 0;
      this._pmReport = null;
      this._renderInterviewPhase();

      // Start PM interview
      await this._startPMInterview();
    } catch(err) {
      Shell.toast('创建失败: ' + err.message, 'error');
      btn.disabled = false; btn.innerHTML = '🚀 启动项目';
    }
  },

  // ══════════════════════════════════════════════════════
  //  AI-PM INTERVIEW
  // ══════════════════════════════════════════════════════
  async _startPMInterview() {
    const sysPrompt = this._pmSystemPrompt(
      this._selectedType.name,
      this._projectName,
      this._projectDesc
    );

    this._sending = true;
    this._renderInterviewPhase();

    // Send system + initial message to get first question
    const sessionKey = `wizard:pm:${this._projectId}`;
    let fullText = '';

    await API.streamChat({
      model: 'main',
      message: sysPrompt + '\n\n请开始第一轮访谈。',
      user: sessionKey,
      signal: this._getAbortSignal(),
      onDelta: (delta) => {
        fullText += delta;
        this._updateStreamingMessage(fullText);
      },
      onDone: (text) => {
        const { clean, report } = this._extractReport(text);
        this._pmMessages.push({ role: 'ai', text: clean, icon: '📋', sender: 'AI-PM' });
        if (report) this._pmReport = report;
        this._pmRound++;
        this._sending = false;
        this._renderInterviewPhase();
      },
      onError: (err) => {
        this._sending = false;
        Shell.toast('AI-PM 回复失败: ' + err.message, 'error');
        this._renderInterviewPhase();
      }
    });
  },

  // ══════════════════════════════════════════════════════
  //  MESSAGE SENDING
  // ══════════════════════════════════════════════════════
  async sendMessage(phase) {
    if (this._sending) return;
    const input = document.getElementById('interviewInput');
    const text = input?.value?.trim();
    if (!text) return;

    const messages = phase === 'pm' ? this._pmMessages : this._baMessages;
    const icon = phase === 'pm' ? '📋' : '📊';
    const sender = phase === 'pm' ? 'AI-PM' : 'AI-BA';
    const sessionKey = phase === 'pm'
      ? `wizard:pm:${this._projectId}`
      : `wizard:ba:${this._projectId}`;

    // Add user message
    messages.push({ role: 'user', text });
    input.value = '';
    input.style.height = 'auto';

    this._sending = true;
    this._renderInterviewPhase();

    let fullText = '';
    await API.streamChat({
      model: 'main',
      message: text,
      user: sessionKey,
      signal: this._getAbortSignal(),
      onDelta: (delta) => {
        fullText += delta;
        this._updateStreamingMessage(fullText);
      },
      onDone: (text) => {
        if (phase === 'pm') {
          const { clean, report } = this._extractReport(text);
          messages.push({ role: 'ai', text: clean, icon, sender });
          if (report) this._pmReport = report;
          this._pmRound++;
        } else {
          const { clean, prd } = this._extractPRD(text);
          messages.push({ role: 'ai', text: clean, icon, sender });
          if (prd) this._prdContent = prd;
          this._baRound++;
        }
        this._sending = false;
        this._renderInterviewPhase();
      },
      onError: (err) => {
        this._sending = false;
        Shell.toast(`${sender} 回复失败: ${err.message}`, 'error');
        this._renderInterviewPhase();
      }
    });
  },

  async requestGenerate(phase) {
    if (this._sending) return;

    const messages = phase === 'pm' ? this._pmMessages : this._baMessages;
    const prompt = phase === 'pm'
      ? '请根据以上访谈内容，现在生成项目启动报告。'
      : '请根据以上访谈内容，现在生成初步需求摘要文档。';
    const icon = phase === 'pm' ? '📋' : '📊';
    const sender = phase === 'pm' ? 'AI-PM' : 'AI-BA';
    const sessionKey = phase === 'pm'
      ? `wizard:pm:${this._projectId}`
      : `wizard:ba:${this._projectId}`;

    messages.push({ role: 'user', text: prompt });
    this._sending = true;
    this._renderInterviewPhase();

    let fullText = '';
    await API.streamChat({
      model: 'main',
      message: prompt,
      user: sessionKey,
      signal: this._getAbortSignal(),
      onDelta: (delta) => {
        fullText += delta;
        this._updateStreamingMessage(fullText);
      },
      onDone: (text) => {
        if (phase === 'pm') {
          const { clean, report } = this._extractReport(text);
          messages.push({ role: 'ai', text: clean, icon, sender });
          if (report) this._pmReport = report;
        } else {
          const { clean, prd } = this._extractPRD(text);
          messages.push({ role: 'ai', text: clean, icon, sender });
          if (prd) this._prdContent = prd;
        }
        this._sending = false;
        this._renderInterviewPhase();
      },
      onError: (err) => {
        this._sending = false;
        Shell.toast(`生成失败: ${err.message}`, 'error');
        this._renderInterviewPhase();
      }
    });
  },

  // ══════════════════════════════════════════════════════
  //  PHASE TRANSITIONS
  // ══════════════════════════════════════════════════════
  async confirmReport() {
    Shell.toast('启动报告已确认！AI-BA 开始需求分析...', 'success');
    this._phase = 'ba_interview';
    this._baMessages = [];
    this._baRound = 0;
    this._prdContent = null;
    this._renderInterviewPhase();
    await this._startBAInterview();
  },

  reviseReport() {
    this._pmReport = null;
    this._pmMessages.push({
      role: 'user',
      text: '报告需要修改，请继续了解更多信息后重新生成。'
    });
    this._renderInterviewPhase();
    // Auto-send to AI
    this.sendMessage('pm');
  },

  async _startBAInterview() {
    const sysPrompt = this._baSystemPrompt(
      this._selectedType.name,
      this._projectName,
      this._projectDesc,
      this._pmReport
    );

    this._sending = true;
    this._renderInterviewPhase();

    const sessionKey = `wizard:ba:${this._projectId}`;
    let fullText = '';

    await API.streamChat({
      model: 'main',
      message: sysPrompt + '\n\n请开始需求分析访谈。',
      user: sessionKey,
      signal: this._getAbortSignal(),
      onDelta: (delta) => {
        fullText += delta;
        this._updateStreamingMessage(fullText);
      },
      onDone: (text) => {
        const { clean, prd } = this._extractPRD(text);
        this._baMessages.push({ role: 'ai', text: clean, icon: '📊', sender: 'AI-BA' });
        if (prd) this._prdContent = prd;
        this._baRound++;
        this._sending = false;
        this._renderInterviewPhase();
      },
      onError: (err) => {
        this._sending = false;
        Shell.toast('AI-BA 回复失败: ' + err.message, 'error');
        this._renderInterviewPhase();
      }
    });
  },

  async startReview() {
    Shell.toast('提交需求摘要审查中...', 'info');
    this._phase = 'prd_review';
    this._reviewResults = {};
    this._renderInterviewPhase();

    // Launch all 3 reviews in parallel
    const roles = ['AI-Arch', 'AI-QA', 'AI-PM'];
    const promises = roles.map(role => this._runReview(role));
    await Promise.allSettled(promises);
  },

  async _runReview(role) {
    const prompt = this._reviewPrompt(role, this._prdContent);
    const sessionKey = `wizard:review:${role}:${this._projectId}`;

    let fullText = '';
    return new Promise((resolve) => {
      API.streamChat({
        model: 'main',
        message: prompt,
        user: sessionKey,
        signal: this._getAbortSignal(),
        onDelta: (delta) => { fullText += delta; },
        onDone: (text) => {
          try {
            // Try to parse JSON from the response
            const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const result = JSON.parse(jsonStr);
            this._reviewResults[role] = {
              conclusion: result.conclusion || '有风险',
              summary: result.summary || '审查完成',
              details: result.details || []
            };
          } catch (e) {
            // Fallback: treat entire text as summary
            this._reviewResults[role] = {
              conclusion: '有风险',
              summary: text.slice(0, 200),
              details: ['AI 返回格式不规范，请查看原始内容']
            };
          }
          this._renderInterviewPhase();
          resolve();
        },
        onError: (err) => {
          this._reviewResults[role] = {
            conclusion: '需补充',
            summary: '审查失败: ' + err.message,
            details: ['请重试或检查 AI 服务']
          };
          this._renderInterviewPhase();
          resolve();
        }
      });
    });
  },

  revisePRDBeforeReview() {
    this._prdContent = null;
    this._baMessages.push({
      role: 'user',
      text: '我还有一些需求要补充，请继续访谈。'
    });
    this._renderInterviewPhase();
    this.sendMessage('ba');
  },

  async confirmPRD() {
    Shell.toast('需求摘要已确认！即将进入项目工作台...', 'success');
    // Navigate to project workspace
    setTimeout(() => {
      Router.navigate('/projects/' + this._projectId);
      // Reset wizard state
      this._resetState();
    }, 1000);
  },

  revisePRD() {
    // Go back to BA interview to revise
    this._phase = 'ba_interview';
    this._prdContent = null;
    this._baMessages.push({
      role: 'user',
      text: '根据审查意见，需求摘要需要修改。以下是审查反馈：\n' +
        Object.entries(this._reviewResults).map(([role, r]) =>
          `${role}: ${r.conclusion} — ${r.summary}`
        ).join('\n') +
        '\n\n请根据以上反馈修改需求摘要。'
    });
    this._reviewResults = {};
    this._renderInterviewPhase();
    this.sendMessage('ba');
  },

  // ══════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════
  _getAbortSignal() {
    this._abortCtrl = new AbortController();
    return this._abortCtrl.signal;
  },

  _updateStreamingMessage(text) {
    const el = document.getElementById('interviewTyping');
    if (el) {
      el.innerHTML = `
        <div class="interview-msg ai streaming">
          <div class="interview-msg-avatar">${this._phase === 'pm_interview' ? '📋' : '📊'}</div>
          <div class="interview-msg-body">
            <div class="interview-msg-sender">${this._phase === 'pm_interview' ? 'AI-PM' : 'AI-BA'}</div>
            <div class="interview-msg-content typing-cursor">${this._renderMarkdown(text)}</div>
          </div>
        </div>
      `;
      this._scrollInterviewBottom();
    }
  },

  _extractReport(text) {
    const startTag = '[PROJECT_REPORT_START]';
    const endTag = '[PROJECT_REPORT_END]';
    const startIdx = text.indexOf(startTag);
    const endIdx = text.indexOf(endTag);
    if (startIdx !== -1 && endIdx !== -1) {
      const report = text.substring(startIdx + startTag.length, endIdx).trim();
      const clean = text.substring(0, startIdx).trim();
      return { clean: clean || '项目启动报告已生成，请查看下方内容：', report };
    }
    return { clean: text, report: null };
  },

  _extractPRD(text) {
    // Note: method name kept as _extractPRD for backward compat, but markers changed per spec §3.3
    const startTag = '[REQUIREMENTS_SUMMARY_START]';
    const endTag = '[REQUIREMENTS_SUMMARY_END]';
    const startIdx = text.indexOf(startTag);
    const endIdx = text.indexOf(endTag);
    if (startIdx !== -1 && endIdx !== -1) {
      const prd = text.substring(startIdx + startTag.length, endIdx).trim();
      const clean = text.substring(0, startIdx).trim();
      return { clean: clean || '初步需求摘要已生成，请查看下方内容：', prd };
    }
    return { clean: text, prd: null };
  },

  _scrollInterviewBottom() {
    setTimeout(() => {
      const el = document.getElementById('interviewMessages') || document.querySelector('.review-content');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  },

  _renderMarkdown(text) {
    if (!text) return '';
    // Simple markdown rendering
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>')
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<h[1-3]>)/g, '$1')
      .replace(/(<\/h[1-3]>)<\/p>/g, '$1');
  },

  _resetState() {
    this._step = 1;
    this._selectedType = null;
    this._phases = [];
    this._projectName = '';
    this._projectDesc = '';
    this._projectId = null;
    this._phase = null;
    this._pmMessages = [];
    this._baMessages = [];
    this._pmReport = null;
    this._prdContent = null;
    this._reviewResults = {};
    this._sending = false;
    this._pmRound = 0;
    this._baRound = 0;
  },
};
window.WizardPage = WizardPage;
