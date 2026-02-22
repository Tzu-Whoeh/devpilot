/* ═══ Dashboard Page ═══ */
const DashboardPage = {
  async render() {
    Shell.setBreadcrumb([{ label: '📊 项目总览', path: '/' }]);

    const projects = await API.getProjects();

    if (!projects || projects.length === 0) {
      this._renderWelcome();
    } else {
      this._renderProjects(projects);
    }
  },

  _renderWelcome() {
    const types = Object.values(MOCK_TEMPLATES);
    Shell.setContent(`
      <div class="page-container">
        <div class="dash-welcome">
          <div class="dash-welcome-icon">🚀</div>
          <h1>欢迎使用 <span>DevPilot</span></h1>
          <p>AI 驱动的项目协作平台，选择一个任务类型开始你的项目</p>
        </div>
        <div class="type-cards">
          ${types.map(t => `
            <div class="type-card card-interactive" onclick="Router.navigate('/new?type=${t.type_key}')">
              <div class="type-card-icon">${t.icon}</div>
              <div class="type-card-name">${t.name}</div>
              <div class="type-card-desc">${t.description}</div>
              <div class="type-card-phases">${t.phase_count} 个阶段</div>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  },

  _renderProjects(projects) {
    Shell.setContent(`
      <div class="page-container">
        <div class="dash-header">
          <h2>我的项目</h2>
          <button class="btn btn-primary" onclick="Router.navigate('/new')">
            ✨ 新建项目
          </button>
        </div>
        <div class="project-grid">
          ${projects.map(p => this._renderCard(p)).join('')}
        </div>
      </div>
    `);
  },

  _renderCard(project) {
    const phase = project.phases[project.current_phase_index];
    const completed = project.phases.filter(p => p.status === 'approved').length;
    const total = project.phases.length;
    const pct = Math.round((completed / total) * 100);

    // D6: 5 standard project status badges
    const projectBadge = this._projectBadge(project.status, phase?.status);
    const phaseHint = this._phaseHint(project.status, phase);

    return `
      <div class="project-card" onclick="Router.navigate('/projects/${project.id}')">
        <div class="pc-header">
          <div class="pc-title">
            <span class="icon">${project.type_icon}</span>
            <h3>${_esc(project.name)}</h3>
          </div>
          ${projectBadge}
        </div>
        <div class="pc-type">${project.type_name}</div>
        <div class="pc-phase">当前阶段: <strong>${phase.icon} ${phase.name}</strong> · ${this._statusText(phase.status)}</div>
        <div class="pc-progress">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="pc-progress-text">${completed}/${total} 完成</div>
        </div>
        <div class="pc-action">${phaseHint}</div>
      </div>
    `;
  },

  /** D6: 5 standard project status badges */
  _projectBadge(projectStatus, phaseStatus) {
    const badges = {
      'in_progress': '<span class="badge badge-blue">🔵 进行中</span>',
      'pending':     '<span class="badge badge-gray">⚪ 待启动</span>',
      'completed':   '<span class="badge badge-green">✅ 已完成</span>',
      'archived':    '<span class="badge badge-dim">📦 已归档</span>',
      'rejected':    '<span class="badge badge-red">🔴 已驳回</span>',
    };
    if (badges[projectStatus]) return badges[projectStatus];
    // Infer from phase if project-level status not set
    if (phaseStatus === 'awaiting_approval') return '<span class="badge badge-orange">⏳ 需操作</span>';
    if (phaseStatus === 'ai_working') return badges['in_progress'];
    if (phaseStatus === 'rejected') return badges['rejected'];
    return badges['pending'];
  },

  /** Phase-level action hint */
  _phaseHint(projectStatus, phase) {
    if (projectStatus === 'completed') return '👉 点击查看项目成果';
    if (projectStatus === 'archived') return '📦 已归档';
    if (!phase) return '👉 点击进入';
    if (phase.status === 'awaiting_approval') return `👉 点击进入审批 ${phase.name} 文档`;
    if (phase.status === 'ai_working') return '👉 点击查看 AI 进度';
    if (phase.status === 'rejected') return `👉 点击重新开始 ${phase.name}`;
    return '👉 点击进入开始第一阶段';
  },

  _statusText(status) {
    const map = { pending:'待开始', ai_working:'AI 工作中', awaiting_approval:'等待审批', approved:'已完成', rejected:'已驳回' };
    return map[status] || status;
  }
};
window.DashboardPage = DashboardPage;
