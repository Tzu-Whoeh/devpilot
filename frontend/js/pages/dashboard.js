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

    let badge = '', action = '';
    if (project.status === 'completed') {
      badge = '<span class="badge badge-green">✅ 已完成</span>';
      action = '👉 点击查看项目成果';
    } else if (phase.status === 'awaiting_approval') {
      badge = '<span class="badge badge-orange">⏳ 需要你操作</span>';
      action = `👉 点击进入审批${phase.name}文档`;
    } else if (phase.status === 'ai_working') {
      badge = '<span class="badge badge-blue">🤖 AI 工作中</span>';
      action = '👉 点击进入查看 AI 进度';
    } else if (phase.status === 'rejected') {
      badge = '<span class="badge badge-red">↩️ 已驳回</span>';
      action = `👉 点击进入重新开始${phase.name}`;
    } else {
      badge = '<span class="badge badge-gray">▶ 待开始</span>';
      action = '👉 点击进入开始第一阶段';
    }

    return `
      <div class="project-card" onclick="Router.navigate('/projects/${project.id}')">
        <div class="pc-header">
          <div class="pc-title">
            <span class="icon">${project.type_icon}</span>
            <h3>${_esc(project.name)}</h3>
          </div>
          ${badge}
        </div>
        <div class="pc-type">${project.type_name}</div>
        <div class="pc-phase">当前阶段: <strong>${phase.icon} ${phase.name}</strong> · ${this._statusText(phase.status)}</div>
        <div class="pc-progress">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="pc-progress-text">${completed}/${total} 完成</div>
        </div>
        <div class="pc-action">${action}</div>
      </div>
    `;
  },

  _statusText(status) {
    const map = { pending:'待开始', ai_working:'AI 工作中', awaiting_approval:'等待审批', approved:'已完成', rejected:'已驳回' };
    return map[status] || status;
  }
};
window.DashboardPage = DashboardPage;
